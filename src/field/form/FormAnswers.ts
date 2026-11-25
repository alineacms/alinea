import type {Submission} from '#/core/Connection.js'
import {isRecord} from '#/core/util/Objects.js'
import {formState} from './FormConditions.js'
import {
  type FormDefinition,
  type FormInputData,
  type FormSectionData,
  inputsOf,
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
  return inputsOf(
    definition.flatMap(item =>
      item.control === 'section' ? item.inputs : [item]
    )
  )
}

/** The answers of a form in reading order, a repeated section is one */
export function formColumns(definition: FormDefinition): Array<FormColumn> {
  return definition.flatMap((item): Array<FormColumn> => {
    if (item.control === 'content') return []
    if (item.control !== 'section') return [item]
    return item.repeat && item.key ? [item] : inputsOf(item.inputs)
  })
}

/** The answers of a submission grouped by the sections of its form */
export function answerGroups(
  definition: FormDefinition,
  values: Record<string, unknown>,
  locale?: string | null
): Array<FormAnswerGroup> {
  const {hidden} = formState(definition, values, locale)
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
          answers: inputsOf(item.inputs).map(answer(values, ''))
        })
        continue
      }
      // Each item of a repeatable section is a group of its own
      itemsOf(values[item.key]).forEach((entry, index) =>
        groups.push({
          title: `${item.label} ${index + 1}`,
          answers: inputsOf(item.inputs).map(answer(entry, itemId('', index)))
        })
      )
      continue
    }
    if (item.control === 'content') continue
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
      const answers = inputsOf(column.inputs)
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
 * The columns of the form as it is now, followed by those of earlier
 * versions and other languages the submissions were sent with, so no answer
 * is left out. Answers are stored by key, a column is one key.
 */
export function exportColumns(
  definition: FormDefinition,
  submissions: Array<Submission>
): Array<FormColumn> {
  const columns = formColumns(definition)
  const seen = new Set(columns.map(columnKey))
  for (const submission of submissions)
    for (const column of formColumns(sentDefinition(submission)))
      if (!seen.has(columnKey(column))) {
        seen.add(columnKey(column))
        columns.push(column)
      }
  return columns
}

/** The form a submission was sent with, in its language */
export function sentDefinition(submission: Submission): FormDefinition {
  return Array.isArray(submission.definition)
    ? (submission.definition as FormDefinition)
    : []
}

/**
 * The column of the form a submission was sent with that holds the answer to
 * a column, by its key: its labels and options are those the visitor saw
 */
export function sentColumn(
  column: FormColumn,
  submission: Submission
): FormColumn | undefined {
  const key = columnKey(column)
  return formColumns(sentDefinition(submission)).find(
    other => columnKey(other) === key
  )
}

/** The answer to a column as text, as the visitor answered it */
export function submissionText(
  column: FormColumn,
  submission: Submission
): string {
  return columnText(sentColumn(column, submission) ?? column, submission.values)
}

/**
 * The submissions as CSV, a column per input of the form as it is now and
 * one per repeatable section, then those of earlier versions of the form.
 * Excel needs the byte order mark to read it as UTF-8.
 */
export function submissionsCsv(
  definition: FormDefinition,
  submissions: Array<Submission>
): string {
  const columns = exportColumns(definition, submissions)
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
    ...columns.map(column => submissionText(column, submission))
  ])
  const lines = [header, ...rows].map(row => row.map(csvCell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

function csvCell(value: string): string {
  // Cells starting with these run as formulas in spreadsheets
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
