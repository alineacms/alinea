import {isRecord} from '#/core/util/Objects.js'
import type {FieldPath, FieldValidationError} from '#/core/Validation.js'
import {choices} from './FormChoices.js'
import {
  type FormCondition,
  type FormConditionData,
  type FormRule,
  type FormRuleData,
  needsValue,
  operators
} from './FormConditions.js'
import {Input} from './FormInput.js'

/** A row of a form in reading order, sections before their inputs */
export interface FormEntry {
  row: Record<string, unknown> & {_id: string}
  input: Input
  /** The position in reading order, rules only use entries before them */
  index: number
  /** From the form field to the row, as validation errors point at it */
  path: FieldPath
  labels: Array<string>
}

export function readingOrder(
  inputs: Record<string, Input>,
  rows: unknown,
  path: FieldPath = [],
  labels: Array<string> = []
): Array<FormEntry> {
  const result = Array<FormEntry>()
  function visit(rows: unknown, path: FieldPath, labels: Array<string>) {
    if (!Array.isArray(rows)) return
    rows.forEach((row, index) => {
      if (!isRecord(row) || typeof row._id !== 'string') return
      const input = inputs[row._type as string]
      if (!input) return
      const at = [...path, index]
      const within = [...labels, input.label]
      result.push({
        row: row as FormEntry['row'],
        input,
        index: result.length,
        path: at,
        labels: within
      })
      if (input.control === 'section')
        visit(row.inputs, [...at, 'inputs'], within)
    })
  }
  visit(rows, path, labels)
  return result
}

/** The name of the entry for editors, its label or its type */
export function entryLabel(entry: FormEntry): string {
  const label = entry.row.label
  return typeof label === 'string' && label ? label : entry.input.label
}

/** The stored rules of an entry */
export function storedCondition(value: unknown): FormCondition | undefined {
  if (!isRecord(value) || !Array.isArray(value.rules)) return undefined
  const rules = value.rules.filter(
    (rule): rule is FormRule => isRecord(rule) && typeof rule.input === 'string'
  )
  if (rules.length === 0) return undefined
  return {match: value.match === 'any' ? 'any' : 'all', rules}
}

/**
 * Why a rule cannot work, or undefined while it can. Rules of an entry at
 * this position in reading order use the entries before it, rules outside
 * the form such as those of a mail use every entry (`Infinity`).
 */
export function ruleProblem(
  rule: FormRule,
  index: number,
  byId: Map<string, FormEntry>
): string | undefined {
  const target = byId.get(rule.input)
  if (!target || target.input.control === 'section')
    return 'Its rule uses an input that was removed'
  const label = entryLabel(target)
  if (target.index >= index) return `Its rule uses ${label}, which is below it`
  const kind = Input.kind(target.input)
  if (!(rule.op in operators[kind]))
    return `Its rule on ${label} no longer fits ${label}`
  if (!needsValue(rule.op)) return undefined
  if (kind === 'choice' || kind === 'choices') {
    const chosen = Array.isArray(rule.value) ? rule.value : []
    if (chosen.length === 0) return `Its rule on ${label} has no options`
    const ids = new Set(choices(target.row.options).map(choice => choice.id))
    if (chosen.some(id => !ids.has(id)))
      return `Its rule uses an option of ${label} that was removed`
    return undefined
  }
  if (rule.value === undefined || rule.value === '' || rule.value === null)
    return `Its rule on ${label} has no value`
  return undefined
}

/** The rules as the site gets them: keys and values, without broken rules */
export function conditionData(
  value: unknown,
  index: number,
  byId: Map<string, FormEntry>,
  key: (row: Record<string, unknown>) => string
): FormConditionData | undefined {
  const condition = storedCondition(value)
  if (!condition) return undefined
  const rules = condition.rules.flatMap((rule): Array<FormRuleData> => {
    if (ruleProblem(rule, index, byId)) return []
    const target = byId.get(rule.input)!
    const data: FormRuleData = {input: key(target.row), op: rule.op}
    if (!needsValue(rule.op)) return [data]
    if (Array.isArray(rule.value)) {
      const ids = new Set(rule.value)
      data.value = choices(target.row.options)
        .filter(choice => ids.has(choice.id))
        .map(choice => choice.value)
    } else {
      data.value = rule.value
    }
    return [data]
  })
  if (rules.length === 0) return undefined
  return {match: condition.match, rules}
}

const conditionFields = {
  showWhen: 'Show this input',
  disableWhen: 'Disable this input'
}

/** Rules that point at removed or moved inputs or at removed options */
export function ruleErrors(
  order: Array<FormEntry>
): Array<FieldValidationError> {
  const byId = new Map(order.map(entry => [entry.row._id, entry]))
  return order.flatMap(entry =>
    Object.entries(conditionFields).flatMap(([field, label]) => {
      const condition = storedCondition(entry.row[field])
      if (!condition) return []
      const problem = condition.rules
        .map(rule => ruleProblem(rule, entry.index, byId))
        .find(Boolean)
      if (!problem) return []
      return [
        {
          path: [...entry.path, field],
          labels: [...entry.labels, label],
          message: problem
        }
      ]
    })
  )
}

/** The entries whose rules use this row */
export function dependents(
  order: Array<FormEntry>,
  id: string
): Array<FormEntry> {
  return order.filter(entry =>
    Object.keys(conditionFields).some(field =>
      storedCondition(entry.row[field])?.rules.some(rule => rule.input === id)
    )
  )
}

/** The rows without the rules that use the row with this id */
export function withoutRulesOn(rows: unknown, id: string): unknown {
  if (!Array.isArray(rows)) return rows
  return rows.map(row => {
    if (!isRecord(row)) return row
    let next: Record<string, unknown> = row
    for (const field of Object.keys(conditionFields)) {
      const condition = storedCondition(row[field])
      if (!condition?.rules.some(rule => rule.input === id)) continue
      const rules = condition.rules.filter(rule => rule.input !== id)
      next = {...next, [field]: rules.length > 0 ? {...condition, rules} : null}
    }
    if (Array.isArray(row.inputs))
      next = {...next, inputs: withoutRulesOn(row.inputs, id)}
    return next
  })
}

/** The rules in words, eg. "Service is IT" or "2 rules match" */
export function describeCondition(
  value: unknown,
  byId: Map<string, FormEntry>
): string | undefined {
  const condition = storedCondition(value)
  if (!condition) return undefined
  const {rules, match} = condition
  if (rules.length > 1)
    return match === 'all'
      ? `${rules.length} rules match`
      : `any of ${rules.length} rules matches`
  const [rule] = rules
  const target = byId.get(rule.input)
  if (!target) return 'a removed input matches'
  const single = Array.isArray(rule.value) && rule.value.length === 1
  const op =
    (single && singleOperators[rule.op]) ||
    operators[Input.kind(target.input)][rule.op] ||
    rule.op
  return [entryLabel(target), op, ruleValue(rule, target)]
    .filter(Boolean)
    .join(' ')
}

const singleOperators: Partial<Record<FormRule['op'], string>> = {
  is: 'is',
  isNot: 'is not',
  includes: 'includes',
  excludes: 'does not include'
}

function ruleValue(rule: FormRule, target: FormEntry): string {
  if (!needsValue(rule.op) || rule.value === undefined) return ''
  if (!Array.isArray(rule.value)) return String(rule.value)
  const ids = new Set(rule.value)
  return choices(target.row.options)
    .filter(choice => ids.has(choice.id))
    .map(choice => choice.label)
    .join(' or ')
}
