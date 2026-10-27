import type {Submission} from '#/core/Connection.js'
import {isRecord} from '#/core/util/Objects.js'
import {formState} from './FormConditions.js'
import {
  type FormDefinition,
  type FormInputData,
  type FormSectionData,
  itemId
} from './FormDefinition.js'

/** An answer as editors see it */
export interface FormAnswer {
  input: FormInputData
  /** The answer as it is stored */
  value: unknown
  text: string
  /** Hidden by the rules of the form when it was sent, or not filled in */
  state: 'answered' | 'empty' | 'hidden'
}

export interface FormAnswerGroup {
  /** The title of the section the answers are in, numbered for an item */
  title?: string
  answers: Array<FormAnswer>
}

/**
 * What a submission has an answer for: an input, or a repeatable section
 * that holds a list of items
 */
export type FormColumn = FormInputData | FormSectionData

/** The inputs of a form in reading order, also those of repeated sections */
export function formInputs(definition: FormDefinition): Array<FormInputData> {
  return definition.flatMap(item =>
    item.control === 'section' ? item.inputs : [item]
  )
}

/** The answers of a form in reading order, a repeated section is one */
export function formColumns(definition: FormDefinition): Array<FormColumn> {
  return definition.flatMap((item): Array<FormColumn> => {
    if (item.control !== 'section') return [item]
    return item.repeat && item.key ? [item] : item.inputs
  })
}

/** The answers of a submission grouped by the sections of its form */
export function answerGroups(
  definition: FormDefinition,
  values: Record<string, unknown>
): Array<FormAnswerGroup> {
  const {hidden} = formState(definition, values)
  const answer =
    (values: Record<string, unknown>, suffix: string) =>
    (input: FormInputData): FormAnswer => {
      const value = values[input.key]
      const text = answerText(input, value)
      const state = hidden.has(input.id + suffix)
        ? 'hidden'
        : text
          ? 'answered'
          : 'empty'
      return {input, value, text, state}
    }
  // In reading order: inputs between sections are a group without a title
  const groups = Array<FormAnswerGroup>()
  for (const item of definition) {
    if (item.control === 'section') {
      if (hidden.has(item.id)) continue
      if (!item.repeat || !item.key) {
        groups.push({
          title: item.label,
          answers: item.inputs.map(answer(values, ''))
        })
        continue
      }
      // Each item of a repeatable section is a group of its own
      itemsOf(values[item.key]).forEach((entry, index) =>
        groups.push({
          title: `${item.label} ${index + 1}`,
          answers: item.inputs.map(answer(entry, itemId('', index)))
        })
      )
      continue
    }
    const last = groups.at(-1)
    if (last && last.title === undefined)
      last.answers.push(answer(values, '')(item))
    else groups.push({answers: [answer(values, '')(item)]})
  }
  return groups.filter(group => group.answers.length > 0)
}

/** The items of a repeatable section in the answers */
export function itemsOf(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/**
 * The answer to a column as text. The items of a repeatable section are
 * numbered, with the answers of each item after it.
 */
export function columnText(
  column: FormColumn,
  values: Record<string, unknown>
): string {
  if (column.control !== 'section')
    return answerText(column, values[column.key])
  const items = itemsOf(column.key ? values[column.key] : undefined)
  return items
    .map((item, index) => {
      const answers = column.inputs
        .map(input => answerText(input, item[input.key]))
        .filter(Boolean)
        .join(', ')
      return items.length > 1 ? `${index + 1}. ${answers}` : answers
    })
    .filter(Boolean)
    .join('; ')
}

/** The key of the answer to a column */
export function columnKey(column: FormColumn): string {
  return column.control === 'section' ? (column.key ?? column.id) : column.key
}

/** An answer as text: the labels of choices, Yes for a checked check */
export function answerText(input: FormInputData, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (input.control === 'check') return value ? 'Yes' : ''
  const values = Array.isArray(value) ? value : [value]
  return values
    .map(value => {
      const choice = input.choices?.find(choice => choice.value === value)
      if (choice) return choice.label
      // Files are kept as references, their name stands for them
      if (isRecord(value) && typeof value.name === 'string') return value.name
      return String(value)
    })
    .join(', ')
}

/** An answer to a choice input as filters find it */
export function choiceText(key: string, value: string): string {
  return `|${key}=${value}|`
}

/**
 * What a submission is found by: its answers as lowercase text for searches,
 * and the answers to choice inputs outside repeatable sections for filters
 */
export function submissionIndex(
  definition: FormDefinition,
  values: Record<string, unknown>
): {search: string; choices: string} {
  const columns = formColumns(definition)
  const search = columns
    .map(column => columnText(column, values))
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
  const choices = columns.flatMap(column => {
    if (column.control === 'section' || !column.choices?.length) return []
    const answer = values[column.key]
    const chosen = Array.isArray(answer) ? answer : [answer]
    return chosen
      .filter(value => typeof value === 'string')
      .map(value => choiceText(column.key, value))
  })
  return {search, choices: choices.join('')}
}

/**
 * The submissions as CSV, a column per input of the form as it is now and
 * one per repeatable section. Excel needs the byte order mark to read it as
 * UTF-8.
 */
export function submissionsCsv(
  definition: FormDefinition,
  submissions: Array<Submission>
): string {
  const columns = formColumns(definition)
  const header = [
    'Received',
    'Status',
    'Language',
    'Page',
    ...columns.map(c => c.label)
  ]
  const rows = submissions.map(submission => [
    new Date(submission.createdAt * 1000).toISOString(),
    submission.status,
    submission.locale ?? '',
    submission.page ?? '',
    ...columns.map(column => columnText(column, submission.values))
  ])
  const lines = [header, ...rows].map(row => row.map(csvCell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

function csvCell(value: string): string {
  // Cells starting with these run as formulas in spreadsheets
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
