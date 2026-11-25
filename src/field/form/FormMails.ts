import type {FormMail} from '#/core/Forms.js'
import {isRecord} from '#/core/util/Objects.js'
import {columnKey, columnText, formColumns} from './FormAnswers.js'
import {holds, withLocale} from './FormConditions.js'
import {formDefinition, inputKey} from './FormDefinition.js'
import type {Input} from './FormInput.js'
import {
  conditionData,
  type FormEntry,
  readingOrder,
  ruleProblem,
  storedCondition
} from './FormRules.js'

/** A mail to send for a submission, with the name editors gave it */
export interface FormMailOut {
  name: string
  mail: FormMail
}

/**
 * The mails of a form whose rules hold for the answers, with the answers
 * filled in for their `{{key}}` and every answer for `{{all answers}}`. The
 * key of a repeatable section fills in all of its items. A mail with a rule
 * that no longer works is not sent, rather than sent to everyone. Rules on
 * the language test `locale`.
 */
export function formMails(
  inputs: Record<string, Input>,
  rows: unknown,
  mails: unknown,
  values: Record<string, unknown>,
  locale?: string | null
): Array<FormMailOut> {
  if (!Array.isArray(mails)) return []
  const order = readingOrder(inputs, rows)
  const byId = new Map(order.map(entry => [entry.row._id, entry]))
  const columns = formColumns(formDefinition(inputs, rows, order))
  const all = columns
    .map(column => [column.label, columnText(column, values)])
    .filter(([, answer]) => answer)
    .map(([label, answer]) => `${label}: ${answer}`)
    .join('\n')
  const answer = (key: string) => {
    if (key === allAnswers) return all
    const column = columns.find(column => columnKey(column) === key)
    return column ? columnText(column, values) : ''
  }
  const answerOf = (id: unknown) => {
    const entry = typeof id === 'string' ? byId.get(id) : undefined
    // An input of a repeatable section has an answer per item
    if (!entry || entry.repeat) return undefined
    const value = values[inputKey(entry.row)]
    return typeof value === 'string' && !/[\r\n]/.test(value)
      ? value
      : undefined
  }
  return mails.filter(isRecord).flatMap((mail): Array<FormMailOut> => {
    if (mailProblem(mail, byId)) return []
    const condition = conditionData(mail.sendWhen, Infinity, byId, inputKey)
    if (!holds(condition, withLocale(values, locale), true)) return []
    const to =
      mail.to === 'input'
        ? [answerOf(mail.input)].filter(Boolean)
        : addresses(mail.address)
    if (to.length === 0) return []
    const fill = (template: unknown) =>
      text(template).replace(placeholder, (_, key) => answer(key))
    const replyTo = answerOf(mail.replyTo)
    const cc = addresses(mail.cc)
    return [
      {
        name: text(mail.name) || 'Mail',
        mail: {
          to: to as Array<string>,
          ...(cc.length > 0 && {cc}),
          ...(replyTo && {replyTo}),
          // A line break in a header could add headers of its own
          subject: fill(mail.subject).replace(/[\r\n]+/g, ' '),
          text: fill(mail.body)
        }
      }
    ]
  })
}

/** The keys a form has answers for, which mails can insert with `{{key}}` */
export function answerKeys(
  inputs: Record<string, Input>,
  rows: unknown,
  order = readingOrder(inputs, rows)
): Set<string> {
  return new Set(
    formColumns(formDefinition(inputs, rows, order)).map(columnKey)
  )
}

/**
 * The first `{{key}}` in the subject or body of a mail that is not a key of
 * the form, in the texts of `language` when it is not the one being edited.
 * The mail is still sent, the key fills in nothing.
 */
export function mailTextProblem(
  mail: object,
  keys: Set<string>,
  language?: string
): string | undefined {
  const row = mail as Record<string, unknown>
  const name = text(row.name) || 'A mail'
  const where = language ? ` in ${language.toUpperCase()}` : ''
  for (const [field, label] of [
    ['subject', 'Subject'],
    ['body', 'Body']
  ]) {
    for (const [, key] of text(row[field]).matchAll(placeholder))
      if (key !== allAnswers && !keys.has(key))
        return `${name}: ${label}${where} uses {{${key}}}, which is not a key of this form`
  }
  return undefined
}

/** Why a mail cannot be sent as it is set up, or undefined while it can */
export function mailProblem(
  mail: object,
  byId: Map<string, FormEntry>
): string | undefined {
  const {name: label, sendWhen, to} = mail as Record<string, unknown>
  const name = text(label) || 'A mail'
  const rules = storedCondition(sendWhen)?.rules ?? []
  for (const rule of rules) {
    const problem = ruleProblem(rule, Infinity, byId)
    if (problem) return `${name}: ${problem}`
  }
  for (const field of ['input', 'replyTo'] as const) {
    if (field === 'input' && to !== 'input') continue
    const id = (mail as Record<string, unknown>)[field]
    if (typeof id !== 'string' || !id) continue
    const which = field === 'input' ? 'recipient' : 'reply to'
    const entry = byId.get(id)
    if (!entry) return `${name}: Its ${which} input was removed`
    if (entry.repeat) return `${name}: Its ${which} input repeats`
  }
  return undefined
}

// Keys are slugs, so the space keeps it apart from the key of an input
const allAnswers = 'all answers'
const placeholder = /\{\{\s*([\w-]+|all answers)\s*\}\}/g

function addresses(value: unknown): Array<string> {
  return text(value)
    .split(/[,;\s]+/)
    .filter(Boolean)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
