import {track} from '#/core/Tracker.js'
import {
  type FieldsDefinition,
  type TabFields,
  type Type,
  type TypeConfig,
  type
} from '#/core/Type.js'
import {values} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {
  IcOutlineTableRows,
  IcRoundCallSplit,
  IcRoundEdit,
  IcRoundEmail,
  IcRoundRule,
  IcRoundSend
} from '#/dashboard/icons.js'
import {check} from '#/field/check.js'
import {entry} from '#/field/link/EntryLink.js'
import {number} from '#/field/number.js'
import {path} from '#/field/path.js'
import {richText} from '#/field/richtext.js'
import {select} from '#/field/select.js'
import {tab, tabs} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import {type FormField, condition, form} from './FormField.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import type {ListRow} from '#/core/ListRow.js'
import type {Schema} from '#/core/Schema.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {ListField} from '#/core/field/ListField.js'
import type {FieldGetter} from '#/core/Tracker.js'
import {formColumns} from './FormAnswers.js'
import {formDefinition} from './FormDefinition.js'
import type {Input} from './FormInput.js'
import type {FormCondition} from './FormConditions.js'
import {answerKeys, mailProblem, mailTextProblem} from './FormMails.js'
import {readingOrder} from './FormRules.js'
import {languageText, shareRows} from './FormShare.js'

export interface FormTypeConfig<
  Inputs extends Record<string, Input>,
  Fields extends FieldsDefinition,
  Tabs extends Record<string, Type> = {}
> extends Omit<TypeConfig<Fields>, 'fields' | 'tabs'> {
  /** The inputs editors can add, eg. `{...Form.defaults, rating: Rating}` */
  inputs: Inputs
  /** Fields of the form entry next to its inputs, eg. an intro */
  fields?: Fields
  /**
   * Tabs after the Form tab, eg. a Page tab when forms are pages of their
   * own, made with `Field.tab`
   */
  tabs?: Tabs
  /**
   * Every language of the form asks the same: its inputs, keys, settings,
   * rules and mails are shared, each language has its own texts
   */
  shared?: boolean
}

/** The fields every form entry has, next to the fields of its type */
export interface FormTypeFields<Type extends string> {
  title: ReturnType<typeof text>
  path: ReturnType<typeof path>
  inputs: FormField<Type>
  mails: FormMailList
  after: ReturnType<typeof afterSending>
  message: ReturnType<typeof text>
  page: ReturnType<typeof entry>
  keep: ReturnType<typeof keepFor>
  limit: ReturnType<typeof limitFields>['limit']
  full: ReturnType<typeof limitFields>['full']
}

const formTypes = new WeakSet<Type>()

/** A notification mail as it is stored */
export interface FormMailRow extends ListRow {
  _type: 'mail'
  name: string
  to: 'address' | 'input' | null
  address: string
  cc: string
  /** The id of the email input whose answer it is sent to */
  input: string | null
  replyTo: string | null
  sendWhen: FormCondition | null
  subject: string
  /** Rich text, or the plain text of a mail made before it was */
  body: TextDoc | string
  /** Sent with the files of the submission */
  attach: boolean
}

export type FormMailList = ListField<
  FormMailRow,
  FormMailRow,
  FieldOptions<Array<FormMailRow>> & {schema: Schema}
>

/** The notification mails of a form, sent when it is submitted */
/** The fields of a mail that each language has of its own */
const mailTexts = new Set(['subject', 'body'])

function mailList(inputsField: FormField, shared?: boolean): FormMailList {
  const inputs = Field.options(inputsField).inputs
  const emailInputs = (get: FieldGetter) => {
    const result: Record<string, string> = {}
    // Inputs of repeatable sections have an address per item
    for (const item of formColumns(formDefinition(inputs, get(inputsField))))
      if (item.control !== 'section' && item.attributes.type === 'email')
        result[item.id] = item.label
    return result
  }
  const to = select('Send to', {
    options: {address: 'An address', input: 'An input of the form'},
    initialValue: 'address'
  })
  const Mail = type('Mail', {
    icon: IcRoundEmail,
    fields: {},
    tabs: {
      recipient: tab('Recipient', {
        fields: {
          name: text('Name', {
            required: true,
            help: 'For editors, eg. IT helpdesk'
          }),
          to,
          address: track.options(
            text('Address', {help: 'Separate several addresses with commas'}),
            get => ({
              hidden: get(to) === 'input',
              required: get(to) !== 'input'
            })
          ),
          cc: text('CC', {
            help: 'Also sent to these addresses, separated with commas'
          }),
          input: track.options(select('Input', {options: {}}), get => ({
            options: emailInputs(get),
            hidden: get(to) !== 'input',
            required: get(to) === 'input'
          })),
          replyTo: track.options(
            select('Reply to', {
              options: {},
              help: 'Answering the mail writes to the address in this input'
            }),
            get => ({options: emailInputs(get)})
          )
        }
      }),
      when: tab('Send when', {
        icon: IcRoundCallSplit,
        fields: {sendWhen: condition('Send this mail', 'send')}
      }),
      message: tab('Message', {
        fields: {
          subject: languageText(text('Subject', {required: true})),
          body: languageText(
            richText('Body', {
              required: true,
              help: 'Insert an answer with {{key}}, eg. {{name}}, every answer with {{all answers}} and a link to the submission with {{submission link}}'
            })
          ),
          attach: check('Attach uploaded files', {
            description: 'Send the files of the submission with the mail',
            help: 'For recipients without access to the dashboard'
          })
        }
      })
    }
  })
  return track.options(
    new ListField<
      FormMailRow,
      FormMailRow,
      FieldOptions<Array<FormMailRow>> & {schema: Schema}
    >(
      {mail: Mail},
      {
        options: {
          label: 'Mails',
          schema: {mail: Mail},
          initialValue: [],
          shared
        },
        view: viewKeys.FormMailsInput,
        ...(shared && {
          share: (source: Array<FormMailRow>, target?: Array<FormMailRow>) =>
            shareRows(
              source,
              target,
              () => mailTexts,
              (_, __, value) => value
            ) as Array<FormMailRow>
        })
      }
    ),
    get => {
      const rows = get(inputsField)
      const order = readingOrder(inputs, rows)
      const byId = new Map(order.map(entry => [entry.row._id, entry]))
      const keys = answerKeys(inputs, rows, order)
      return {
        validate: (mails: Array<FormMailRow>) => {
          for (const mail of mails) {
            const problem =
              mailProblem(mail, byId) ?? mailTextProblem(mail, keys)
            if (problem) return problem
          }
          return undefined
        }
      }
    }
  )
}

/** Whether a type was made with `Form.type` */
export function isFormType(type: Type): boolean {
  return formTypes.has(type)
}

/**
 * A tab with the submissions of the form in an entry, for types that hold a
 * form with `Field.form`, eg. `tabs(tab('Content', {...}), Form.submissions())`
 */
export function submissionsTab(label = 'Submissions') {
  return tab(label, {
    icon: IcOutlineTableRows,
    view: viewKeys.FormSubmissions
  })
}

/**
 * How long submissions are kept, in days, for the privacy of visitors. Add
 * it under the key `keep` to a type that holds a form with `Field.form`.
 */
export function keepFor() {
  return select('Keep submissions', {
    options: {
      '30': 'For 30 days',
      '90': 'For 90 days',
      '365': 'For a year',
      '730': 'For two years'
    },
    placeholder: 'Until they are deleted',
    help: 'Older submissions and their files are removed',
    // The submissions of every language are kept alike
    shared: true
  })
}

/**
 * How many submissions a form takes, eg. the places on a waiting list, and
 * what visitors see once it is full. Spread them under the keys `limit` and
 * `full` into a type that holds a form with `Field.form`.
 */
export function limitFields() {
  const limit = number('Most submissions', {
    minValue: 1,
    // The places are those of all languages together
    shared: true,
    help: 'The form closes once this many were sent, eg. the places on a waiting list'
  })
  return {
    limit,
    full: track.options(
      text('Message when full', {
        multiline: true,
        help: 'Shown instead of the form once it is full'
      }),
      get => ({hidden: !get(limit)})
    )
  }
}

function afterSending() {
  return select('After sending', {
    options: {message: 'Show a message', page: 'Go to a page'},
    initialValue: 'message'
  })
}

/**
 * A type for form entries: their inputs in a Form tab, the answers visitors
 * sent in a Submissions tab and what happens after sending in Notifications.
 * Keep form entries in a root of their own and link pages to them.
 */
export function formType<
  Inputs extends Record<string, Input>,
  Fields extends FieldsDefinition = {},
  Tabs extends Record<string, Type> = {}
>(
  label: string,
  {
    inputs,
    fields,
    tabs: extraTabs = {} as Tabs,
    shared,
    ...config
  }: FormTypeConfig<Inputs, Fields, Tabs>
): Type<
  FormTypeFields<Extract<keyof Inputs, string>> & Fields & TabFields<Tabs>
> {
  const after = afterSending()
  const inputsField = form('Inputs', {inputs, shared})
  const result = type(label, {
    icon: IcRoundRule,
    ...config,
    // Tabs are a section, typed by the fields they hold
    fields: <any>tabs(
      tab('Form', {
        icon: IcRoundEdit,
        fields: {
          title: text('Title', {required: true, width: 0.5}),
          path: path('Path', {required: true, width: 0.5}),
          ...fields,
          inputs: inputsField
        }
      }),
      ...values(extraTabs),
      submissionsTab(),
      tab('Notifications', {
        icon: IcRoundSend,
        fields: {
          mails: mailList(inputsField, shared),
          after,
          message: track.options(
            text('Message', {
              multiline: true,
              help: 'Shown to the visitor instead of the form'
            }),
            get => ({hidden: get(after) === 'page'})
          ),
          page: track.options(
            entry('Page', {help: 'Where the visitor goes after sending'}),
            get => ({hidden: get(after) !== 'page'})
          ),
          keep: keepFor(),
          ...limitFields()
        }
      })
    )
  })
  formTypes.add(result)
  return result as any
}
