import {isRecord} from '#/core/util/Objects.js'

/** What kind of answer an input gives, which decides how rules test it */
export type FormKind =
  | 'text'
  | 'number'
  | 'date'
  | 'choice'
  | 'choices'
  | 'check'
  | 'file'

export type FormOperator =
  | 'is'
  | 'isNot'
  | 'includes'
  | 'excludes'
  | 'contains'
  | 'lt'
  | 'gt'
  | 'checked'
  | 'unchecked'
  | 'filled'
  | 'empty'

export type FormRuleValue = string | number | Array<string>

/** A rule as it is stored, pointing at the row of an input and its options */
export interface FormRule {
  id: string
  /** The id of the row of the input */
  input: string
  op: FormOperator
  /** Ids of options for choices, a number, date or text for the others */
  value?: FormRuleValue
}

export interface FormCondition {
  match: 'all' | 'any'
  rules: Array<FormRule>
}

/** A rule as the site gets it, pointing at the key of an input */
export interface FormRuleData {
  input: string
  op: FormOperator
  /** Values of options for choices */
  value?: FormRuleValue
}

export interface FormConditionData {
  match: 'all' | 'any'
  rules: Array<FormRuleData>
}

/** The operators that can test an input of this kind, with their labels */
export const operators: Record<
  FormKind,
  Partial<Record<FormOperator, string>>
> = {
  text: {
    is: 'is',
    contains: 'contains',
    filled: 'is filled in',
    empty: 'is empty'
  },
  number: {
    is: 'is',
    lt: 'is less than',
    gt: 'is more than',
    filled: 'is filled in',
    empty: 'is empty'
  },
  date: {
    is: 'is',
    lt: 'is before',
    gt: 'is after',
    filled: 'is filled in',
    empty: 'is empty'
  },
  choice: {
    is: 'is any of',
    isNot: 'is none of',
    filled: 'is chosen',
    empty: 'is not chosen'
  },
  choices: {
    includes: 'includes any of',
    excludes: 'includes none of',
    filled: 'has a choice',
    empty: 'has no choice'
  },
  check: {checked: 'is checked', unchecked: 'is not checked'},
  file: {filled: 'has a file', empty: 'has no file'}
}

/** Operators that compare with a value */
export function needsValue(op: FormOperator): boolean {
  return !['checked', 'unchecked', 'filled', 'empty'].includes(op)
}

interface ConditionalItem {
  id: string
  control: string
  key?: string
  showWhen?: FormConditionData
  disableWhen?: FormConditionData
  inputs?: Array<ConditionalItem>
  repeat?: object
}

export interface FormState {
  /**
   * Ids of items that are not shown, not required and not stored. Inputs of
   * a repeatable section are in it per item, see `itemId`.
   */
  hidden: Set<string>
  /** Ids of inputs that are shown, but not editable and not stored */
  disabled: Set<string>
}

/**
 * Which items of a form are hidden or disabled for these answers, by key.
 * Rules only use inputs above them, so one pass in reading order sees every
 * answer a rule needs. A hidden or disabled input counts as empty. The
 * answers of a repeatable section are a list of items, the rules of its
 * inputs see the answers above the section and those above them in their
 * own item.
 */
export function formState(
  items: Array<ConditionalItem>,
  values: Record<string, unknown>
): FormState {
  const state: FormState = {hidden: new Set(), disabled: new Set()}
  function visit(
    items: Array<ConditionalItem>,
    hidden: boolean,
    values: Record<string, unknown>,
    answers: Record<string, unknown>,
    suffix: string
  ) {
    for (const item of items) {
      const off = hidden || !holds(item.showWhen, answers, true)
      if (off) state.hidden.add(item.id + suffix)
      if (item.inputs && item.repeat && item.key) {
        const list = values[item.key]
        if (Array.isArray(list))
          list.forEach((entry, index) =>
            visit(
              item.inputs!,
              off,
              isRecord(entry) ? entry : {},
              {...answers},
              `${suffix}:${index}`
            )
          )
        continue
      }
      if (item.inputs) {
        visit(item.inputs, off, values, answers, suffix)
        continue
      }
      const disabled = !off && holds(item.disableWhen, answers, false)
      if (disabled) state.disabled.add(item.id + suffix)
      if (item.key && !off && !disabled) answers[item.key] = values[item.key]
    }
  }
  visit(items, false, values, {}, '')
  return state
}

/** Whether the rules hold for these answers, `otherwise` without rules */
export function holds(
  condition: FormConditionData | undefined,
  answers: Record<string, unknown>,
  otherwise: boolean
): boolean {
  if (!condition || condition.rules.length === 0) return otherwise
  const test = (rule: FormRuleData) => matches(rule, answers[rule.input])
  return condition.match === 'any'
    ? condition.rules.some(test)
    : condition.rules.every(test)
}

/** Whether an answer passes a rule */
export function matches(rule: FormRuleData, answer: unknown): boolean {
  const given = answers(answer)
  const {value} = rule
  switch (rule.op) {
    case 'filled':
      return given.length > 0
    case 'empty':
      return given.length === 0
    case 'checked':
      return given.length > 0 && given[0] !== 'false'
    case 'unchecked':
      return given.length === 0 || given[0] === 'false'
    case 'is':
    case 'includes':
      return given.some(answer => equals(answer, value))
    case 'isNot':
    case 'excludes':
      return !given.some(answer => equals(answer, value))
    case 'contains':
      return (
        typeof value === 'string' &&
        given.some(answer => answer.toLowerCase().includes(value.toLowerCase()))
      )
    case 'lt':
    case 'gt': {
      if (given.length === 0 || value === undefined || Array.isArray(value))
        return false
      const order = compare(given[0], value)
      return rule.op === 'lt' ? order < 0 : order > 0
    }
  }
}

/** An answer as the strings it holds, none while it is empty */
function answers(answer: unknown): Array<string> {
  if (answer === undefined || answer === null || answer === false) return []
  if (Array.isArray(answer)) return answer.flatMap(answers)
  if (typeof answer === 'object') return ['file']
  const text = String(answer).trim()
  return text ? [text] : []
}

function equals(answer: string, value: FormRuleValue | undefined): boolean {
  if (Array.isArray(value)) return value.includes(answer)
  if (typeof value === 'number') return Number(answer) === value
  return (
    typeof value === 'string' && answer.toLowerCase() === value.toLowerCase()
  )
}

function compare(answer: string, value: string | number): number {
  if (typeof value === 'number') return Number(answer) - value
  // Dates are ISO strings, which sort as text
  return answer < value ? -1 : answer > value ? 1 : 0
}
