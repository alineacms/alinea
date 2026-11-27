import type {FormMail} from '#/core/Forms.js'
import {
  type ElementNode,
  LinkMark,
  type Mark,
  type Node,
  type TextNode,
  textDoc
} from '#/core/TextDoc.js'
import {isRecord} from '#/core/util/Objects.js'
import {columnKey, columnText, formColumns} from './FormAnswers.js'
import {holds, withLocale} from './FormConditions.js'
import {formDefinition, inputKey} from './FormDefinition.js'
import type {Input} from './FormInput.js'
import {type FormLocaleMessages, translate} from './FormMessages.js'
import {
  answersTable,
  docHtml,
  docText,
  linkHtml,
  mailDocument,
  safeHref,
  textHtml
} from './FormMailHtml.js'
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
  /** Sent with the files of the submission, by Attach uploaded files */
  attach?: true
}

export interface FormMailOptions {
  /** The locale of the form, which rules on the language test */
  locale?: string | null
  /** Where editors find the submission, for `{{submission link}}` */
  link?: string
  /** The urls of the entries the bodies link to, by id */
  entries?: Record<string, string>
  /** Texts that replace those of alinea, see `forms.messages` */
  messages?: FormLocaleMessages
}

/**
 * The mails of a form whose rules hold for the answers, with the answers
 * filled in for their `{{key}}` and every answer for `{{all answers}}`. The
 * key of a repeatable section fills in all of its items. A mail with a rule
 * that no longer works is not sent, rather than sent to everyone. Rules on
 * the language test `locale`, the texts mails add are in its language. The
 * body is rich text, sent as text and html.
 */
export function formMails(
  inputs: Record<string, Input>,
  rows: unknown,
  mails: unknown,
  values: Record<string, unknown>,
  {locale, link, entries = {}, messages}: FormMailOptions = {}
): Array<FormMailOut> {
  if (!Array.isArray(mails)) return []
  const message = translate(locale, messages)
  const checked = message({code: 'checked'})
  const order = readingOrder(inputs, rows)
  const byId = new Map(order.map(entry => [entry.row._id, entry]))
  const columns = formColumns(formDefinition(inputs, rows, order))
  const answers = columns
    .map((column): [string, string] => [
      column.label,
      columnText(column, values, checked)
    ])
    .filter(([, answer]) => answer)
  const all = answers.map(([label, answer]) => `${label}: ${answer}`)
  const answer = (key: string) => {
    if (key === allAnswers) return all.join('\n')
    if (key === submissionLink) return link ?? ''
    const column = columns.find(column => columnKey(column) === key)
    return column ? columnText(column, values, checked) : ''
  }
  const answerHtml = (key: string) => {
    if (key === allAnswers) return all.map(textHtml).join('<br>')
    if (key === submissionLink && link)
      return linkHtml(link, message({code: 'viewSubmission'}))
    return textHtml(answer(key))
  }
  const href = (mark: Mark) =>
    safeHref(
      mark[LinkMark.link] === 'entry'
        ? entries[mark[LinkMark.entry] ?? '']
        : mark.href
    )
  const blocks = {[allAnswers]: answersTable(answers)}
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
    const fill = (template: string) =>
      template.replace(placeholder, (_, key) => answer(key))
    const replyTo = answerOf(mail.replyTo)
    const cc = addresses(mail.cc)
    // A line break in a header could add headers of its own
    const subject = fill(text(mail.subject)).replace(/[\r\n]+/g, ' ')
    const body = textDoc(mail.body)
    const content = docHtml(body, {fill: answerHtml, href}, blocks)
    return [
      {
        name: text(mail.name) || 'Mail',
        mail: {
          to: to as Array<string>,
          ...(cc.length > 0 && {cc}),
          ...(replyTo && {replyTo}),
          subject,
          text: fill(docText(body, href)),
          content,
          html: mailDocument(subject, content, locale)
        },
        ...(mail.attach === true && {attach: true as const})
      }
    ]
  })
}

/** The ids of the entries the bodies of mails link to */
export function linkedEntries(mails: unknown): Array<string> {
  const ids = new Set<string>()
  const visit = (nodes: Array<Node>) => {
    for (const node of nodes) {
      for (const mark of (node as TextNode).marks ?? [])
        if (mark[LinkMark.link] === 'entry' && mark[LinkMark.entry])
          ids.add(mark[LinkMark.entry])
      const content = (node as ElementNode).content
      if (Array.isArray(content)) visit(content)
    }
  }
  if (Array.isArray(mails))
    for (const mail of mails.filter(isRecord)) visit(textDoc(mail.body))
  return [...ids]
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
  for (const [label, value] of [
    ['Subject', text(row.subject)],
    ['Body', docText(textDoc(row.body))]
  ]) {
    for (const [, key] of value.matchAll(placeholder))
      if (key !== allAnswers && key !== submissionLink && !keys.has(key))
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

// Keys are slugs, so the space keeps these apart from the key of an input
const allAnswers = 'all answers'
const submissionLink = 'submission link'
const placeholder = /\{\{\s*([\w-]+|all answers|submission link)\s*\}\}/g

function addresses(value: unknown): Array<string> {
  return text(value)
    .split(/[,;\s]+/)
    .filter(Boolean)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
