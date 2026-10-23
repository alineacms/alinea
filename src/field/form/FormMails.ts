import type {FormMail} from '#/core/Forms.js'
import {isRecord} from '#/core/util/Objects.js'
import {answerText, formInputs} from './FormAnswers.js'
import {holds} from './FormConditions.js'
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
 * filled in for their `{{key}}`. A mail with a rule that no longer works is
 * not sent, rather than sent to everyone.
 */
export function formMails(
  inputs: Record<string, Input>,
  rows: unknown,
  mails: unknown,
  values: Record<string, unknown>
): Array<FormMailOut> {
  if (!Array.isArray(mails)) return []
  const order = readingOrder(inputs, rows)
  const byId = new Map(order.map(entry => [entry.row._id, entry]))
  const definition = formInputs(formDefinition(inputs, rows, order))
  const answer = (key: string) => {
    const input = definition.find(input => input.key === key)
    return input ? answerText(input, values[key]) : ''
  }
  const answerOf = (id: unknown) => {
    const entry = typeof id === 'string' ? byId.get(id) : undefined
    const value = entry ? values[inputKey(entry.row)] : undefined
    return typeof value === 'string' ? value : undefined
  }
  return mails.filter(isRecord).flatMap((mail): Array<FormMailOut> => {
    if (mailProblem(mail, byId)) return []
    const condition = conditionData(mail.sendWhen, Infinity, byId, inputKey)
    if (!holds(condition, values, true)) return []
    const to =
      mail.to === 'input'
        ? [answerOf(mail.input)].filter(Boolean)
        : text(mail.address)
            .split(/[,;\s]+/)
            .filter(Boolean)
    if (to.length === 0) return []
    const fill = (template: unknown) =>
      text(template).replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, key) => answer(key))
    const replyTo = answerOf(mail.replyTo)
    return [
      {
        name: text(mail.name) || 'Mail',
        mail: {
          to: to as Array<string>,
          ...(replyTo && {replyTo}),
          subject: fill(mail.subject),
          text: fill(mail.body)
        }
      }
    ]
  })
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
    if (typeof id === 'string' && id && !byId.has(id))
      return `${name}: Its ${field === 'input' ? 'recipient' : 'reply to'} input was removed`
  }
  return undefined
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
