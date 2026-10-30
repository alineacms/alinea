'use client'

import {type FormState, formState} from '#/field/form/FormConditions.js'
import {formPage, formSpam} from '#/field/form/FormSpam.js'
import type {PrepareUploadResult} from '#/core/Connection.js'
import type {FormUploadFile} from '#/core/Forms.js'
import type {FormErrors, FormResult} from '#/field/form/FormSubmission.js'
import {
  type FormDefinition,
  type FormInputData,
  type FormItem,
  type FormSectionData,
  itemId,
  itemName,
  nameKey
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
  useRef,
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
  | 'item'
  | 'add'
  | 'remove'
  | 'submit'
  | 'confirmation'

export interface FormInputViewProps {
  input: FormInputData
  /** The id of the control, the label points at it */
  id: string
  /**
   * The name of the control: the key of the input, or its name in an item of
   * a repeatable section, eg. `participants.0.name`
   */
  name: string
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
  /**
   * Asks for a ticket to upload a file, eg. a server action that calls
   * `cms.forms.prepareUpload`. The browser then uploads files itself, which
   * keeps them out of the action. Without it files are sent to the action.
   */
  upload?: (file: FormUploadFile) => Promise<PrepareUploadResult>
  /**
   * Answers the form starts with by the key of their input, instead of the
   * initial values set in the form builder, eg. `{product: 'Bike'}` for a
   * hidden input on the page of a product
   */
  values?: Record<string, string>
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
  definition: defined,
  values: prefilled,
  views = {},
  action,
  upload,
  errors,
  submitLabel = 'Send',
  onChange,
  onSubmit,
  ...props
}: FormProps) {
  const definition = useMemo(
    () => (prefilled ? prefill(defined, prefilled) : defined),
    [defined, prefilled]
  )
  const nextItem = useRef(0)
  // The items of each repeatable section, by an id that stays with an item
  // when one above it is removed
  const [items, setItems] = useState(() =>
    initialItems(definition, () => nextItem.current++)
  )
  const [values, setValues] = useState(() => initialValues(definition, items))
  const state = useMemo(
    () => formState(definition, values),
    [definition, values]
  )
  const [result, send, pending] = useActionState(
    async (_: FormResult | undefined, posted: FormData) => {
      const uploaded = upload ? await uploadFiles(upload, posted) : posted
      if (!(uploaded instanceof FormData)) return uploaded
      const result = await action!(uploaded)
      if (result.ok && result.redirect) window.location.assign(result.redirect)
      return result
    },
    undefined
  )
  function change(event: FormEvent<HTMLFormElement>) {
    onChange?.(event)
    setValues(readValues(definition, new FormData(event.currentTarget), items))
  }

  // The answers of an item move with it, so the rules of the other items
  // keep seeing theirs
  const repeat: RepeatActions = {
    items,
    add(section) {
      const item = nextItem.current++
      const key = section.key!
      const added = initialValues(section.inputs, {})
      setItems(current => ({
        ...current,
        [key]: [...(current[key] ?? []), item]
      }))
      setValues(current => ({
        ...current,
        [key]: [...itemList(current[key]), added]
      }))
    },
    remove(section, item) {
      const key = section.key!
      const index = (items[key] ?? []).indexOf(item)
      setItems(current => ({
        ...current,
        [key]: (current[key] ?? []).filter(other => other !== item)
      }))
      setValues(current => ({
        ...current,
        [key]: itemList(current[key]).filter((_, at) => at !== index)
      }))
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event)
    if (!action || event.defaultPrevented) return
    // Sent from here rather than as the action of the form element, which
    // React resets after it is sent, losing the answers when one is invalid
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    fromAddress(definition, data)
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
  const context = {
    views,
    errors: errors ?? failed?.errors ?? {},
    state,
    repeat,
    scope: topScope
  }
  return part(
    views.form,
    'form',
    {
      ...props,
      onChange: change,
      onSubmit: submit,
      'aria-busy': pending
    },
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

/** The definition with the initial values of inputs replaced */
function prefill(
  definition: FormDefinition,
  values: Record<string, string>
): FormDefinition {
  const fill = (input: FormInputData): FormInputData => {
    if (!(input.key in values)) return input
    const value = values[input.key]
    // A check is checked by any value but an empty one
    const initialValue = input.control === 'check' ? value !== '' : value
    return {...input, initialValue}
  }
  return definition.map(item => {
    if (item.control !== 'section') return fill(item)
    if (item.repeat) return item
    return {...item, inputs: item.inputs.map(fill)}
  })
}

/**
 * Fills in what is taken from the address of the page: the page itself, and
 * hidden inputs that read a parameter of it
 */
function fromAddress(definition: FormDefinition, data: FormData) {
  const {href, search} = window.location
  data.set(formPage, href)
  const params = new URLSearchParams(search)
  const inputs = definition.flatMap(item =>
    item.control !== 'section' ? [item] : item.repeat ? [] : item.inputs
  )
  for (const input of inputs) {
    const param = input.settings.param
    if (input.attributes.type !== 'hidden' || typeof param !== 'string')
      continue
    const value = param && params.get(param)
    if (value && data.has(input.key)) data.set(input.key, value)
  }
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

/** The items of repeatable sections, and adding and removing them */
interface RepeatActions {
  /** The ids of the items by the key of their section */
  items: Record<string, Array<number>>
  add(section: FormSectionData): void
  remove(section: FormSectionData, item: number): void
}

/** Where an input is: in the form, or in an item of a repeatable section */
interface FormScope {
  /** Added to the ids of inputs in the state, see `itemId` */
  suffix: string
  /** The name of the control of an input by its key */
  name(key: string): string
}

const topScope: FormScope = {suffix: '', name: key => key}

interface FormItemViewProps {
  item: FormItem
  views: FormViews
  errors: Record<string, string>
  state: FormState
  repeat: RepeatActions
  scope: FormScope
}

function FormItemView({
  item,
  views,
  errors,
  state,
  repeat,
  scope
}: FormItemViewProps) {
  if (state.hidden.has(item.id + scope.suffix)) return null
  if (item.control === 'section')
    return (
      <FormSection
        section={item}
        views={views}
        errors={errors}
        state={state}
        repeat={repeat}
      />
    )
  const name = scope.name(item.key)
  const props: FormInputViewProps = {
    input: item,
    id: `form-${item.id}${scope.suffix.replace(':', '-')}`,
    name,
    error: errors[name],
    disabled: state.disabled.has(item.id + scope.suffix),
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
  repeat: RepeatActions
}

function FormSection({
  section,
  views,
  errors,
  state,
  repeat
}: FormSectionProps) {
  const context = {views, errors, state, repeat}
  const {key} = section
  if (!section.repeat || !key)
    return part(views.section, 'fieldset', {'data-section': section.type}, [
      part(views.legend, 'legend', {key: 'legend'}, section.label),
      section.help &&
        part(views.help, 'p', {key: 'help', 'data-help': ''}, section.help),
      ...section.inputs.map(input => (
        <FormItemView
          key={input.id}
          item={input}
          {...context}
          scope={topScope}
        />
      ))
    ])
  const {min, max, add} = section.repeat
  const items = repeat.items[key] ?? []
  const error = errors[key]
  const errorId = error ? `form-${section.id}-error` : undefined
  return part(
    views.section,
    'fieldset',
    {
      'data-section': section.type,
      'data-repeat': '',
      'aria-describedby': errorId
    },
    [
      part(views.legend, 'legend', {key: 'legend'}, section.label),
      section.help &&
        part(views.help, 'p', {key: 'help', 'data-help': ''}, section.help),
      ...items.map((item, index) =>
        part(
          views.item,
          'div',
          {
            key: item,
            role: 'group',
            'aria-label': `${section.label} ${index + 1}`,
            'data-item': index
          },
          [
            // Marks the item when none of its inputs are filled in
            <input
              key="item"
              type="hidden"
              name={itemName(key, index)}
              value=""
            />,
            ...section.inputs.map(input => (
              <FormItemView
                key={input.id}
                item={input}
                {...context}
                scope={{
                  suffix: itemId('', index),
                  name: inputKey => itemName(key, index, inputKey)
                }}
              />
            )),
            items.length > min &&
              part(
                views.remove,
                'button',
                {
                  key: 'remove',
                  type: 'button',
                  'aria-label': `Remove ${section.label} ${index + 1}`,
                  onClick: () => repeat.remove(section, item)
                },
                'Remove'
              )
          ]
        )
      ),
      errorId &&
        part(
          views.error,
          'p',
          {key: 'error', id: errorId, role: 'alert'},
          error
        ),
      (max === undefined || items.length < max) &&
        part(
          views.add,
          'button',
          {key: 'add', type: 'button', onClick: () => repeat.add(section)},
          add ?? 'Add another'
        )
    ]
  )
}

/** The answers with each file replaced by the token of its upload */
async function uploadFiles(
  upload: (file: FormUploadFile) => Promise<PrepareUploadResult>,
  posted: FormData
): Promise<FormData | FormResult> {
  const data = new FormData()
  const errors: FormErrors = {}
  for (const [key, value] of posted) {
    if (typeof value === 'string') {
      data.append(key, value)
      continue
    }
    if (value.size === 0) continue
    const ticket = await upload({
      // Files in an item of a repeatable section are for the same input
      input: nameKey(key),
      name: value.name,
      size: value.size,
      type: value.type
    })
    if (!ticket.ok) {
      errors[key] = ticket.message
      continue
    }
    const response = await fetch(ticket.url, {
      method: ticket.method,
      headers: {'content-type': value.type || 'application/octet-stream'},
      body: value
    })
    if (response.ok) data.append(key, ticket.token)
    else errors[key] = await response.text()
  }
  if (Object.keys(errors).length > 0) return {ok: false, errors}
  return data
}

/** The answers of the items of a repeatable section */
function itemList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value : []
}

/** The fewest items of each repeatable section, shown when the form opens */
function initialItems(
  definition: FormDefinition,
  next: () => number
): Record<string, Array<number>> {
  const items: Record<string, Array<number>> = {}
  for (const item of definition)
    if (item.control === 'section' && item.repeat && item.key)
      items[item.key] = Array.from({length: item.repeat.min}, next)
  return items
}

/** The answers the form starts with, by key */
function initialValues(
  definition: FormDefinition,
  items: Record<string, Array<number>>
): Record<string, unknown> {
  return answers(definition, items, input => {
    if (input.initialValue !== undefined) return input.initialValue
  })
}

/** The answers in the form, by key, as the rules test them */
function readValues(
  definition: FormDefinition,
  data: FormData,
  items: Record<string, Array<number>>
): Record<string, unknown> {
  return answers(definition, items, (input, name) => {
    const all = data
      .getAll(name)
      .filter(value => typeof value === 'string' || value.size > 0)
    return input.control === 'checkboxes' || all.length > 1 ? all : all[0]
  })
}

/**
 * The answers by key, a list of items for a repeatable section, with the
 * answer of each input by its name
 */
function answers(
  definition: FormDefinition,
  items: Record<string, Array<number>>,
  answer: (input: FormInputData, name: string) => unknown
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  const read = (
    inputs: Array<FormInputData>,
    target: Record<string, unknown>,
    name: (key: string) => string
  ) => {
    for (const input of inputs) {
      const value = answer(input, name(input.key))
      if (value !== undefined) target[input.key] = value
    }
    return target
  }
  for (const item of definition) {
    if (item.control !== 'section') read([item], values, topScope.name)
    else if (!item.repeat || !item.key) read(item.inputs, values, topScope.name)
    else {
      const key = item.key
      values[key] = (items[key] ?? []).map((_, index) =>
        read(item.inputs, {}, inputKey => itemName(key, index, inputKey))
      )
    }
  }
  return values
}

/** The default HTML of an input, its label, help and error */
export function FormInput({
  input,
  id,
  name,
  error,
  disabled,
  views
}: FormInputViewProps) {
  const helpId = input.help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined
  // A hidden input has no row, label or error to show
  if (input.attributes.type === 'hidden')
    return (
      <input
        type="hidden"
        name={name}
        defaultValue={
          input.initialValue === undefined ? '' : String(input.initialValue)
        }
      />
    )
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
    name,
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
            defaultChecked: [input.initialValue].flat().includes(choice.value),
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
    return part(
      views.control,
      'select',
      {...props, defaultValue: defaultValue ?? ''},
      [
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
      ]
    )
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
