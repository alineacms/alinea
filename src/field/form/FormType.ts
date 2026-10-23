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
  IcRoundEdit,
  IcRoundRule,
  IcRoundSend
} from '#/dashboard/icons.js'
import {entry} from '#/field/link/EntryLink.js'
import {path} from '#/field/path.js'
import {select} from '#/field/select.js'
import {tab, tabs} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import {type FormField, form} from './FormField.js'
import type {Input} from './FormInput.js'

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
  after: ReturnType<typeof afterSending>
  message: ReturnType<typeof text>
  page: ReturnType<typeof entry>
}

const formTypes = new WeakSet<Type>()

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
          inputs: form('Inputs', {inputs})
        }
      }),
      tab('Submissions', {
        icon: IcOutlineTableRows,
        view: viewKeys.FormSubmissions
      }),
      tab('Notifications', {
        icon: IcRoundSend,
        fields: {
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
