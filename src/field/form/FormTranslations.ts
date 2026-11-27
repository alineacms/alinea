import {formColumns} from './FormAnswers.js'
import {
  type FormDefinition,
  type FormSectionData,
  formDefinition,
  inputsOf
} from './FormDefinition.js'
import type {Input} from './FormInput.js'

/** The form of another language of the entry */
export interface FormTranslation {
  locale: string
  /** The stored rows of its form field */
  rows: unknown
}

/** How the form of another language differs in what it asks */
export interface FormTranslationDifference {
  locale: string
  /** What differs, eg. `Phone is only in this language` */
  problems: Array<string>
}

interface Answer {
  label: string
  type: string
  options: string
}

/**
 * What visitors answer, by key: answers are stored by key, so languages that
 * ask the same keys with the same types and options line up in submissions
 * and exports
 */
function answersOf(
  inputs: Record<string, Input>,
  definition: FormDefinition
): Map<string, Answer> {
  const result = new Map<string, Answer>()
  const add = (key: string, label: string, type: string, options = '') =>
    result.set(key, {label: label || key, type, options})
  for (const column of formColumns(definition)) {
    if (column.control === 'section') {
      add(column.key ?? column.id, column.label, 'section')
      for (const input of inputsOf((column as FormSectionData).inputs))
        add(`${column.key}.${input.key}`, input.label, input.type)
      continue
    }
    add(
      column.key,
      column.label,
      column.type,
      (column.choices ?? [])
        .map(choice => choice.value)
        .sort()
        .join('\n')
    )
  }
  return result
}

/**
 * The other languages of a form that differ from this one in the keys they
 * ask, the type of an input or the keys of its options
 */
export function translationDifferences(
  inputs: Record<string, Input>,
  rows: unknown,
  others: Array<FormTranslation>
): Array<FormTranslationDifference> {
  const own = answersOf(inputs, formDefinition(inputs, rows))
  const typeLabel = (type: string) =>
    type === 'section' ? 'repeatable section' : (inputs[type]?.label ?? type)
  return others.flatMap(({locale, rows}) => {
    const other = answersOf(inputs, formDefinition(inputs, rows))
    const language = locale.toUpperCase()
    const problems = Array<string>()
    for (const [key, answer] of own) {
      const theirs = other.get(key)
      if (!theirs) {
        problems.push(`${answer.label} (${key}) is not in ${language}`)
        continue
      }
      if (theirs.type !== answer.type)
        problems.push(
          `${answer.label} is ${typeLabel(answer.type)} here and ${typeLabel(theirs.type)} in ${language}`
        )
      else if (theirs.options !== answer.options)
        problems.push(`${answer.label} has other option keys in ${language}`)
    }
    for (const [key, answer] of other)
      if (!own.has(key))
        problems.push(`${answer.label} (${key}) is only in ${language}`)
    return problems.length > 0 ? [{locale, problems}] : []
  })
}
