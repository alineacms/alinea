import type {
  FormDefinition,
  FormInputData,
  FormItem,
  FormSectionData
} from '#/field/form/FormDefinition.js'
import {
  type ComponentProps,
  type ComponentType,
  type ElementType,
  type ReactElement,
  type ReactNode,
  createElement
} from 'react'

/** The parts of a form that a view element can restyle */
export type FormRole =
  | 'form'
  | 'row'
  | 'label'
  | 'help'
  | 'error'
  | 'control'
  | 'option'
  | 'choice'
  | 'section'
  | 'legend'
  | 'submit'

export interface FormInputViewProps {
  input: FormInputData
  /** The id of the control, the label points at it */
  id: string
  error?: string
  views: FormViews
}

/**
 * Elements merge their props into a part of the form, eg.
 * `row: <div className="form-row" />`. A key of an input type replaces that
 * input, eg. `rating: RatingInput`.
 */
export type FormViews<Type extends string = string> = {
  [K in FormRole]?: ReactElement
} & (string extends Type
  ? {
      [type: string]:
        | ReactElement
        | ComponentType<FormInputViewProps>
        | undefined
    }
  : {[K in Type]?: ComponentType<FormInputViewProps>})

export interface FormProps extends Omit<ComponentProps<'form'>, 'children'> {
  definition: FormDefinition
  views?: FormViews
  /** Errors returned by the server, by the key of the input */
  errors?: Record<string, string>
  /** The text of the submit button, unless its view has children */
  submitLabel?: string
}

/** Renders a form definition as plain HTML */
export function Form({
  definition,
  views = {},
  errors = {},
  submitLabel = 'Send',
  ...props
}: FormProps) {
  return part(views.form, 'form', props, [
    ...definition.map(item => (
      <FormItemView key={item.id} item={item} views={views} errors={errors} />
    )),
    part(views.submit, 'button', {key: 'submit', type: 'submit'}, submitLabel)
  ])
}

interface FormItemViewProps {
  item: FormItem
  views: FormViews
  errors: Record<string, string>
}

function FormItemView({item, views, errors}: FormItemViewProps) {
  if (item.control === 'section')
    return <FormSection section={item} views={views} errors={errors} />
  const id = `form-${item.id}`
  const error = errors[item.key]
  const Custom = (views as Record<string, unknown>)[item.type]
  if (typeof Custom === 'function') {
    const View = Custom as ComponentType<FormInputViewProps>
    return <View input={item} id={id} error={error} views={views} />
  }
  return <FormInput input={item} id={id} error={error} views={views} />
}

interface FormSectionProps {
  section: FormSectionData
  views: FormViews
  errors: Record<string, string>
}

function FormSection({section, views, errors}: FormSectionProps) {
  return part(views.section, 'fieldset', {'data-section': section.type}, [
    part(views.legend, 'legend', {key: 'legend'}, section.label),
    section.help &&
      part(views.help, 'p', {key: 'help', 'data-help': ''}, section.help),
    ...section.inputs.map(input => (
      <FormItemView key={input.id} item={input} views={views} errors={errors} />
    ))
  ])
}

/** The default HTML of an input, its label, help and error */
export function FormInput({input, id, error, views}: FormInputViewProps) {
  const helpId = input.help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const grouped = input.control === 'radio' || input.control === 'checkboxes'
  const row = {
    'data-input': input.type,
    'data-width': input.width,
    'data-invalid': error ? '' : undefined
  }
  // The legend of a group of choices is the label of its input
  const label = part(
    views.label,
    grouped ? 'legend' : 'label',
    {key: 'label', htmlFor: grouped ? undefined : id},
    [input.label, input.required && <span key="required"> *</span>]
  )
  const help =
    helpId && part(views.help, 'p', {key: 'help', id: helpId}, input.help)
  const message =
    errorId &&
    part(views.error, 'p', {key: 'error', id: errorId, role: 'alert'}, error)
  const control = {
    name: input.key,
    required: input.required,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    ...input.attributes
  }
  if (input.control === 'check')
    return part(views.row, 'div', row, [
      part(views.choice, 'label', {key: 'choice'}, [
        part(views.control, 'input', {
          ...control,
          key: 'control',
          id,
          type: 'checkbox',
          defaultChecked: input.initialValue === true
        }),
        ' ',
        input.label,
        input.required && <span key="required"> *</span>
      ]),
      help,
      message
    ])
  if (grouped) {
    const type = input.control === 'radio' ? 'radio' : 'checkbox'
    return part(views.row, 'fieldset', row, [
      label,
      help,
      ...(input.choices ?? []).map(choice =>
        part(views.choice, 'label', {key: choice.id}, [
          part(views.control, 'input', {
            ...control,
            key: 'control',
            id: `${id}-${choice.id}`,
            type,
            value: choice.value,
            // A group of checkboxes is valid with any of them checked
            required: type === 'radio' && input.required
          }),
          ' ',
          choice.label
        ])
      ),
      message
    ])
  }
  return part(views.row, 'div', row, [
    label,
    help,
    formControl(input, {...control, key: 'control', id}, views),
    message
  ])
}

function formControl(
  input: FormInputData,
  props: Record<string, unknown>,
  views: FormViews
) {
  const defaultValue =
    input.initialValue === undefined ? undefined : String(input.initialValue)
  if (input.control === 'textarea')
    return part(views.control, 'textarea', {...props, defaultValue})
  if (input.control === 'select') {
    const placeholder = input.settings.placeholder
    return part(views.control, 'select', {...props, defaultValue: ''}, [
      part(
        views.option,
        'option',
        {key: '', value: '', disabled: input.required},
        typeof placeholder === 'string' && placeholder ? placeholder : ''
      ),
      ...(input.choices ?? []).map(choice =>
        part(
          views.option,
          'option',
          {key: choice.id, value: choice.value},
          choice.label
        )
      )
    ])
  }
  return part(views.control, 'input', {...props, defaultValue})
}

/** The element of a part, with the props and children of its view merged */
function part(
  view: ReactElement | undefined,
  type: ElementType,
  props: Record<string, unknown>,
  children?: ReactNode
) {
  if (!view) return createElement(type, props, children)
  const {
    className,
    children: own,
    ...rest
  } = view.props as {
    className?: string
    children?: ReactNode
  }
  const classes = [props.className, className].filter(Boolean).join(' ')
  return createElement(
    type,
    {...props, ...rest, className: classes || undefined},
    own ?? children
  )
}
