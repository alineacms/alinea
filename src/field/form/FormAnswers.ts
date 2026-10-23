import type {Submission} from '#/core/Connection.js'
import {formState} from './FormConditions.js'
import type {FormDefinition, FormInputData} from './FormDefinition.js'

/** An answer as editors see it */
export interface FormAnswer {
  input: FormInputData
  text: string
  /** Hidden by the rules of the form when it was sent, or not filled in */
  state: 'answered' | 'empty' | 'hidden'
}

export interface FormAnswerGroup {
  /** The title of the section the answers are in */
  title?: string
  answers: Array<FormAnswer>
}

/** The inputs of a form in reading order, without their sections */
export function formInputs(definition: FormDefinition): Array<FormInputData> {
  return definition.flatMap(item =>
    item.control === 'section' ? item.inputs : [item]
  )
}

/** The answers of a submission grouped by the sections of its form */
export function answerGroups(
  definition: FormDefinition,
  values: Record<string, unknown>
): Array<FormAnswerGroup> {
  const {hidden} = formState(definition, values)
  const answer = (input: FormInputData): FormAnswer => {
    const value = values[input.key]
    const text = answerText(input, value)
    const state = hidden.has(input.id) ? 'hidden' : text ? 'answered' : 'empty'
    return {input, text, state}
  }
  // In reading order: inputs between sections are a group without a title
  const groups = Array<FormAnswerGroup>()
  for (const item of definition) {
    if (item.control === 'section') {
      if (!hidden.has(item.id))
        groups.push({title: item.label, answers: item.inputs.map(answer)})
      continue
    }
    const last = groups.at(-1)
    if (last && last.title === undefined) last.answers.push(answer(item))
    else groups.push({answers: [answer(item)]})
  }
  return groups.filter(group => group.answers.length > 0)
}

/** An answer as text: the labels of choices, Yes for a checked check */
export function answerText(input: FormInputData, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (input.control === 'check') return value ? 'Yes' : ''
  const values = Array.isArray(value) ? value : [value]
  return values
    .map(value => {
      const choice = input.choices?.find(choice => choice.value === value)
      return choice ? choice.label : String(value)
    })
    .join(', ')
}

/** Whether a submission has an answer containing the text */
export function matchesSearch(
  definition: FormDefinition,
  submission: Submission,
  search: string
): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return formInputs(definition).some(input =>
    answerText(input, submission.values[input.key])
      .toLowerCase()
      .includes(query)
  )
}

/**
 * The submissions as CSV, a column per input of the form as it is now.
 * Excel needs the byte order mark to read it as UTF-8.
 */
export function submissionsCsv(
  definition: FormDefinition,
  submissions: Array<Submission>
): string {
  const inputs = formInputs(definition)
  const header = ['Received', 'Status', 'Language', ...inputs.map(i => i.label)]
  const rows = submissions.map(submission => [
    new Date(submission.createdAt * 1000).toISOString(),
    submission.status,
    submission.locale ?? '',
    ...inputs.map(input => answerText(input, submission.values[input.key]))
  ])
  const lines = [header, ...rows].map(row => row.map(csvCell).join(','))
  return `﻿${lines.join('\r\n')}\r\n`
}

function csvCell(value: string): string {
  // Cells starting with these run as formulas in spreadsheets
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
