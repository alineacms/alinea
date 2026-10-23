import type {FieldOptions, WithoutLabel} from '#/core/Field.js'
import {ListFieldBase} from '#/core/field/ListField.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import type {Schema} from '#/core/Schema.js'
import {type Type, type} from '#/core/Type.js'
import {entries, fromEntries, keys} from '#/core/util/Objects.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import {IcRoundCallSplit} from '#/dashboard/icons.js'
import {check} from '#/field/check.js'
import {path} from '#/field/path.js'
import {select} from '#/field/select.js'
import {tab} from '#/field/tabs.js'
import {text} from '#/field/text.js'
import type {ReactNode} from 'react'
import {
  type FormDefinition,
  type FormItem,
  type FormRow,
  fixedKeys,
  formDefinition,
  formErrors
} from './FormDefinition.js'
import type {FormCondition} from './FormConditions.js'
import {readingOrder, ruleErrors} from './FormRules.js'
import type {Input} from './FormInput.js'

/** Optional settings to configure a form field */
export interface FormOptions<Inputs extends Record<string, Input>> extends Omit<
  FieldOptions<Array<FormRow>>,
  'initialValue' | 'validate'
> {
  /** The inputs editors can add, eg. `{...Form.defaults, rating: Rating}` */
  inputs: Inputs
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
}

/** The options the dashboard sees, the inputs as the types of the rows */
export interface FormFieldOptions<
  Inputs extends Record<string, Input>
> extends FormOptions<Inputs> {
  schema: Schema
}

export class FormField<Type extends string = string> extends ListFieldBase<
  FormRow,
  FormItem<Type>,
  FormFieldOptions<Record<Type, Input>>
> {}

/** Create a form builder: editors add, configure and order inputs */
export function form<Inputs extends Record<string, Input>>(
  label: string,
  options: WithoutLabel<FormOptions<Inputs>>
): FormField<Extract<keyof Inputs, string>> {
  const {inputs} = options
  const fields = entries(inputs as Record<string, Input>)
  const inSection = fields.filter(([, input]) => input.control !== 'section')
  const nested = fromEntries(
    inSection.map(([key, input]) => [key, rowType(input)])
  )
  const schema = fromEntries(
    fields.map(([key, input]) => [
      key,
      input.control === 'section'
        ? sectionType(input, inputs, nested)
        : nested[key]
    ])
  )
  return new FormField(schema, {
    options: {label, ...options, schema},
    view: viewKeys.FormInput,
    nestedErrors(value, context) {
      return [
        ...formErrors(inputs, value, context.path, context.labels),
        ...ruleErrors(readingOrder(inputs, value, context.path, context.labels))
      ]
    },
    // Publishing a draft does not save it again, so keys are fixed whenever
    // the form is saved
    beforeSave({value}) {
      return fixedKeys(inputs, value) as Array<FormRow>
    },
    async queryValue(value) {
      return formDefinition(inputs, value) as FormDefinition<any>
    }
  })
}

const types = new WeakMap<Input, Type>()

/** Inputs are the same type in every form and section they are used in */
function rowType(input: Input): Type {
  let result = types.get(input)
  if (!result) types.set(input, (result = createRowType(input)))
  return result
}

function createRowType(input: Input): Type {
  const settings = input.settings ?? {}
  return type(input.label, {
    icon: input.icon,
    fields: input.fields ?? {},
    tabs: {
      input: tab('Input', {
        fields: {
          label: text('Label', {required: true}),
          key: path('Key', {
            from: 'label',
            help: 'Used in exports and in the data sent to your site'
          }),
          help: text('Help text'),
          required: check('Required', {
            description: 'Must be filled in',
            width: 0.5
          }),
          width: select('Width', {
            options: {full: 'Full', half: 'Half'},
            initialValue: 'full',
            width: 0.5
          })
        }
      }),
      ...(keys(settings).length > 0 && {
        settings: tab(input.label, {fields: settings})
      }),
      logic: tab('Logic', {
        icon: IcRoundCallSplit,
        fields: {
          showWhen: condition('Show this input', 'show'),
          disableWhen: condition('Disable this input', 'disable')
        }
      })
    }
  })
}

export interface FormConditionOptions extends FieldOptions<FormCondition | null> {
  /** Whether the rules show or disable the input */
  effect: 'show' | 'disable'
}

/** The rules of an input or section, edited in its Logic tab */
function condition(
  label: string,
  effect: FormConditionOptions['effect']
): ScalarField<FormCondition | null, FormConditionOptions> {
  return new ScalarField<FormCondition | null, FormConditionOptions>({
    options: {label, effect, initialValue: null},
    view: viewKeys.FormConditionInput
  })
}

function sectionType(
  input: Input,
  inputs: Record<string, Input>,
  nested: Schema
): Type {
  const inSection = fromEntries(
    entries(inputs).filter(([key]) => key in nested)
  )
  return type(input.label, {
    icon: input.icon,
    fields: {
      // Validated and turned into a definition by the form field
      inputs: new FormField(nested, {
        // Without a label the rows show without a fold above them
        options: {
          label: '',
          inputs: inSection,
          schema: nested
        },
        view: viewKeys.FormInput
      })
    },
    tabs: {
      input: tab('Section', {
        fields: {
          label: text('Title', {required: true}),
          help: text('Description', {multiline: true})
        }
      }),
      logic: tab('Logic', {
        icon: IcRoundCallSplit,
        fields: {showWhen: condition('Show this section', 'show')}
      })
    }
  })
}
