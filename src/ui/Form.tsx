'use client'

import {type FormState, formState} from '#/field/form/FormConditions.js'
import {formSpam} from '#/field/form/FormSpam.js'
import type {FormErrors, FormResult} from '#/field/form/FormSubmission.js'
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
  type FormEvent,
  type ReactElement,
  type ReactNode,
  createElement,
  startTransition,
  useActionState,
  useMemo,
  useState
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
  | 'confirmation'

export interface FormInputViewProps {
  input: FormInputData
  /** The id of the control, the label points at it */
  id: string
  error?: string
  /** The rules of the input disable it for the current answers */
  disabled?: boolean
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

export interface FormProps extends Omit<
  ComponentProps<'form'>,
  'children' | 'action'
> {
  definition: FormDefinition
  views?: FormViews
  /**
   * Sends the answers, eg. a server action that calls `cms.forms.submit`.
   * Its errors show on their inputs and its confirmation replaces the form.
   */
  action?: (data: FormData) => Promise<FormResult>
  /** Errors by the key of the input, when the form is sent another way */
  errors?: FormErrors
  /** The text of the submit button, unless its view has children */
  submitLabel?: string
}

/**
 * Renders a form definition as plain HTML. Inputs whose rules do not hold
 * for the answers so far are left out, the browser does not send them.
 */
export function Form({
  definition,
  views = {},
  action,
  errors,
  submitLabel = 'Send',
  onChange,
  onSubmit,
  ...props
}: FormProps) {
  const [values, setValues] = useState(() => initialValues(definition))
  const state = useMemo(
    () => formState(definition, values),
    [definition, values]
  )
  const [result, send, pending] = useActionState(
    async (_: FormResult | undefined, data: FormData) => {
      const result = await action!(data)
      if (result.ok && result.redirect) window.location.assign(result.redirect)
      return result
    },
    undefined
  )
  function change(event: FormEvent<HTMLFormElement>) {
    onChange?.(event)
    setValues(readValues(definition, new FormData(event.currentTarget)))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event)
    if (!action || event.defaultPrevented) return
    // Sent from here rather than as the action of the form element, which
    // React resets after it is sent, losing the answers when one is invalid
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    startTransition(() => send(data))
  }

  if (result?.ok)
    return part(
      views.confirmation,
      'div',
      {role: 'status'},
      result.confirmation || 'Thank you, your answers were sent.'
    )
  const failed = result && !result.ok ? result : undefined
  const context = {views, errors: errors ?? failed?.errors ?? {}, state}
  return part(
    views.form,
    'form',
    {...props, onChange: change, onSubmit: submit, 'aria-busy': pending},
    [
      <input
        key="honeypot"
        name={formSpam.honeypot}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={hidden}
      />,
      <input
        key="shown"
        type="hidden"
        name={formSpam.shownAt}
        // Filled in once the form shows in the browser, so it renders the
        // same on the server and a form sent without scripts is not taken
        // for a bot
        ref={input => {
          if (input && !input.value) input.value = String(Date.now())
        }}
      />,
      ...definition.map(item => (
        <FormItemView key={item.id} item={item} {...context} />
      )),
      failed?.message &&
        part(views.error, 'p', {key: 'message', role: 'alert'}, failed.message),
      part(
        views.submit,
        'button',
        {key: 'submit', type: 'submit', disabled: pending || undefined},
        submitLabel
      )
    ]
  )
}

// Out of sight for people, without styles of the site
const hidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap'
} as const

interface FormItemViewProps {
  item: FormItem
  views: FormViews
  errors: Record<string, string>
  state: FormState
}

function FormItemView({item, views, errors, state}: FormItemViewProps) {
  if (state.hidden.has(item.id)) return null
  if (item.control === 'section')
    return (
      <FormSection section={item} views={views} errors={errors} state={state} />
    )
  const props: FormInputViewProps = {
    input: item,
    id: `form-${item.id}`,
    error: errors[item.key],
    disabled: state.disabled.has(item.id),
    views
  }
  const Custom = (views as Record<string, unknown>)[item.type]
  if (typeof Custom === 'function') {
    const View = Custom as ComponentType<FormInputViewProps>
    return <View {...props} />
  }
  return <FormInput {...props} />
}

interface FormSectionProps {
  section: FormSectionData
  views: FormViews
  errors: Record<string, string>
  state: FormState
}

function FormSection({section, views, errors, state}: FormSectionProps) {
  return part(views.section, 'fieldset', {'data-section': section.type}, [
    part(views.legend, 'legend', {key: 'legend'}, section.label),
    section.help &&
      part(views.help, 'p', {key: 'help', 'data-help': ''}, section.help),
    ...section.inputs.map(input => (
      <FormItemView
        key={input.id}
        item={input}
        views={views}
        errors={errors}
        state={state}
      />
    ))
  ])
}

/** The answers the form starts with, by key */
function initialValues(definition: FormDefinition): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const item of inputsOf(definition))
    if (item.initialValue !== undefined) values[item.key] = item.initialValue
  return values
}

/** The answers in the form, by key, as the rules test them */
function readValues(
  definition: FormDefinition,
  data: FormData
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const item of inputsOf(definition)) {
    const all = data
      .getAll(item.key)
      .filter(value => typeof value === 'string' || value.size > 0)
    values[item.key] =
      item.control === 'checkboxes' || all.length > 1 ? all : all[0]
  }
  return values
}

function inputsOf(definition: FormDefinition): Array<FormInputData> {
  return definition.flatMap(item =>
    item.control === 'section' ? item.inputs : [item]
  )
}

/** The default HTML of an input, its label, help and error */
export function FormInput({
  input,
  id,
  error,
  disabled,
  views
}: FormInputViewProps) {
  const helpId = input.help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  const grouped = input.control === 'radio' || input.control === 'checkboxes'
  const row = {
    'data-input': input.type,
    'data-width': input.width,
    'data-invalid': error ? '' : undefined,
    'data-disabled': disabled ? '' : undefined
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
    ...input.attributes,
    disabled: disabled || undefined
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
