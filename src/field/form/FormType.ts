import {track} from '#/core/Tracker.js'
import {
  type FieldsDefinition,
  type Type,
  type TypeConfig,
  type
} from '#/core/Type.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {
  IcOutlineTableRows,
  IcRoundCallSplit,
  IcRoundEdit,
  IcRoundEmail,
  IcRoundRule,
  IcRoundSend
} from '#/dashboard/icons.js'
import {entry} from '#/field/link/EntryLink.js'
import {path} from '#/field/path.js'
import {select} from '#/field/select.js'
import {tab, tabs} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import {type FormField, condition, form} from './FormField.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import type {ListRow} from '#/core/ListRow.js'
import type {Schema} from '#/core/Schema.js'
import {ListField} from '#/core/field/ListField.js'
import type {FieldGetter} from '#/core/Tracker.js'
import {formInputs} from './FormAnswers.js'
import {formDefinition} from './FormDefinition.js'
import type {Input} from './FormInput.js'
import type {FormCondition} from './FormConditions.js'
import {mailProblem} from './FormMails.js'
import {readingOrder} from './FormRules.js'

export interface FormTypeConfig<
  Inputs extends Record<string, Input>,
  Fields extends FieldsDefinition
> extends Omit<TypeConfig<Fields>, 'fields' | 'tabs'> {
  /** The inputs editors can add, eg. `{...Form.defaults, rating: Rating}` */
  inputs: Inputs
  /** Fields of the form entry next to its inputs, eg. an intro */
  fields?: Fields
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
}

const formTypes = new WeakSet<Type>()

/** A notification mail as it is stored */
export interface FormMailRow extends ListRow {
  _type: 'mail'
  name: string
  to: 'address' | 'input' | null
  address: string
  /** The id of the email input whose answer it is sent to */
  input: string | null
  replyTo: string | null
  sendWhen: FormCondition | null
  subject: string
  body: string
}

export type FormMailList = ListField<
  FormMailRow,
  FormMailRow,
  FieldOptions<Array<FormMailRow>> & {schema: Schema}
>

/** The notification mails of a form, sent when it is submitted */
function mailList(inputsField: FormField): FormMailList {
  const inputs = Field.options(inputsField).inputs
  const emailInputs = (get: FieldGetter) => {
    const result: Record<string, string> = {}
    for (const item of formInputs(formDefinition(inputs, get(inputsField))))
      if (item.attributes.type === 'email') result[item.id] = item.label
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
          subject: text('Subject', {required: true}),
          body: text('Body', {
            required: true,
            multiline: true,
            help: 'Insert answers with {{key}}, eg. {{name}}'
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
        options: {label: 'Mails', schema: {mail: Mail}, initialValue: []},
        view: viewKeys.FormMailsInput
      }
    ),
    get => {
      const order = readingOrder(inputs, get(inputsField))
      const byId = new Map(order.map(entry => [entry.row._id, entry]))
      return {
        validate: (mails: Array<FormMailRow>) => {
          for (const mail of mails) {
            const problem = mailProblem(mail, byId)
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
  Fields extends FieldsDefinition = {}
>(
  label: string,
  {inputs, fields, ...config}: FormTypeConfig<Inputs, Fields>
): Type<FormTypeFields<Extract<keyof Inputs, string>> & Fields> {
  const after = afterSending()
  const inputsField = form('Inputs', {inputs})
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
      tab('Submissions', {
        icon: IcOutlineTableRows,
        view: viewKeys.FormSubmissions
      }),
      tab('Notifications', {
        icon: IcRoundSend,
        fields: {
          mails: mailList(inputsField),
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
          )
        }
      })
    )
  })
  formTypes.add(result)
  return result as any
}
