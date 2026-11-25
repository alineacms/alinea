'use client'

import {type FormState, formState} from '#/field/form/FormConditions.js'
import {formPage, formSpam} from '#/field/form/FormSpam.js'
import type {PrepareUploadResult} from '#/core/Connection.js'
import {type FormUploadFile, uploadFile} from '#/core/Forms.js'
import type {FormErrors, FormResult} from '#/field/form/FormSubmission.js'
import {
  type FormContentData,
  type FormDefinition,
  type FormInputData,
  type FormItem,
  type FormSectionData,
  type FormSectionItem,
  inputsOf,
  isFormInput,
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
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type {TextDoc} from '#/core/TextDoc.js'
import {RichText} from './RichText.js'

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
  | 'choiceControl'
  | 'section'
  | 'legend'
  | 'item'
  | 'add'
  | 'remove'
  | 'submit'
  | 'confirmation'
  | 'content'

/** The texts `<Form>` adds itself, for sites in other languages */
export interface FormLabels {
  /** The submit button */
  submit: string
  /** Shown after sending, when editors set no message of their own */
  confirmation: string
  /** Adds an item to a repeatable section that has no text of its own */
  add: string
  /** Removes an item of a repeatable section */
  remove: string
}

const defaultLabels: FormLabels = {
  submit: 'Send',
  confirmation: 'Thank you, your answers were sent.',
  add: 'Add another',
  remove: 'Remove'
}

export interface FormContentViewProps {
  content: FormContentData
  views: FormViews
}

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

/** Renders an input or the content of a type, see `FormViews` */
export type FormTypeView =
  | ComponentType<FormInputViewProps>
  | ComponentType<FormContentViewProps>

/**
 * Elements merge their props into a part of the form, eg.
 * `row: <div className="form-row" />`. A key of an input type replaces that
 * input, eg. `rating: RatingInput`, a key of a content type renders it, eg.
 * `image: ImageContent`.
 */
export type FormViews<Type extends string = string> = {
  [K in FormRole]?: ReactElement
} & (string extends Type
  ? {[type: string]: ReactElement | FormTypeView | undefined}
  : {[K in Type]?: FormTypeView})

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
  /**
   * The language rules on the language test, that of the form entry it was
   * queried from by default
   */
  locale?: string | null
  /** Errors by the key of the input, when the form is sent another way */
  errors?: FormErrors
  /**
   * The texts `<Form>` adds itself, eg. `{submit: 'Verzenden'}`, unless
   * their view has children
   */
  labels?: Partial<FormLabels>
}

/**
 * Renders a form definition as plain HTML. Inputs whose rules do not hold
 * for the answers so far are left out, the browser does not send them.
 */
export function Form({
  definition: defined,
  values: prefilled,
  locale,
  views = {},
  action,
  upload,
  errors,
  labels: labelsProp,
  onChange,
  onSubmit,
  ...props
}: FormProps) {
  const labels = useMemo(
    () => ({...defaultLabels, ...labelsProp}),
    [labelsProp]
  )
  // Hidden inputs can take a parameter of the address of the page, which
  // the server rendering the form does not see
  const [address, setAddress] = useState<Record<string, string>>({})
  const definition = useMemo(() => {
    const given = {...prefilled, ...address}
    return Object.keys(given).length > 0 ? prefill(defined, given) : defined
  }, [defined, prefilled, address])
  const nextItem = useRef(0)
  // The items of each repeatable section, by an id that stays with an item
  // when one above it is removed
  const [items, setItems] = useState(() =>
    initialItems(definition, () => nextItem.current++)
  )
  const [values, setValues] = useState(() => initialValues(definition, items))
  // Before the rules see the answers, so the server, which sees them, does
  // not hold the visitor to inputs the form never showed
  useEffect(() => {
    const found = addressValues(defined)
    if (Object.keys(found).length === 0) return
    setAddress(found)
    setValues(current => ({...current, ...found}))
  }, [defined])
  const state = useMemo(
    () => formState(definition, values, locale),
    [definition, values, locale]
  )
  const [result, send, pending] = useActionState(
    async (_: FormResult | undefined, posted: FormData) => {
      const uploaded = upload
        ? await uploadFiles(upload, posted, locale)
        : posted
      if (!(uploaded instanceof FormData)) return uploaded
      const result = await action!(uploaded)
      if (result.ok && result.redirect) window.location.assign(result.redirect)
      return result
    },
    undefined
  )
  const failed = result && !result.ok ? result : undefined
  const shown = errors ?? failed?.errors
  // Errors are about the answers that were sent, so an answer that changes
  // since loses its error. Edits count from the last result, as a result
  // with only a message has no errors to tell it apart.
  const sent = errors ?? result
  const [edited, setEdited] = useState({sent, names: new Set<string>()})
  const changed = edited.sent === sent ? edited.names : new Set<string>()
  function edit(name: string) {
    setEdited({sent, names: new Set(changed).add(name)})
  }
  const element = useRef<HTMLFormElement>(null)
  // The submit button is disabled while sending, which takes the focus away,
  // so it goes to the first answer that did not pass
  useEffect(() => {
    if (!result || result.ok) return
    element.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)')
      ?.focus()
  }, [result])
  function change(event: FormEvent<HTMLFormElement>) {
    onChange?.(event)
    const {name} = event.target as {name?: unknown}
    if (typeof name === 'string' && name) edit(name)
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
      edit(key)
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
      edit(key)
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
    data.set(formPage, window.location.href)
    startTransition(() => send(data))
  }

  if (result?.ok)
    return part(
      views.confirmation,
      'div',
      {role: 'status'},
      result.confirmation || labels.confirmation
    )
  const context = {
    views,
    labels,
    errors: Object.fromEntries(
      Object.entries(shown ?? {}).filter(([name]) => !changed.has(name))
    ),
    state,
    repeat,
    scope: topScope
  }
  return part(
    views.form,
    'form',
    {
      ...props,
      ref: element,
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
        changed.size === 0 &&
        part(views.error, 'p', {key: 'message', role: 'alert'}, failed.message),
      part(
        views.submit,
        'button',
        {key: 'submit', type: 'submit', disabled: pending || undefined},
        labels.submit
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
    if (item.control === 'content') return item
    if (item.control !== 'section') return fill(item)
    if (item.repeat) return item
    return {
      ...item,
      inputs: item.inputs.map(input =>
        isFormInput(input) ? fill(input) : input
      )
    }
  })
}

/** The answers of hidden inputs that read a parameter of the address */
function addressValues(definition: FormDefinition): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const inputs = inputsOf(
    definition.flatMap(item =>
      item.control !== 'section' ? [item] : item.repeat ? [] : item.inputs
    )
  )
  const result: Record<string, string> = {}
  for (const input of inputs) {
    const param = input.settings.param
    if (input.attributes.type !== 'hidden' || typeof param !== 'string')
      continue
    const value = param && params.get(param)
    if (value) result[input.key] = value
  }
  return result
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
  labels: FormLabels
  errors: Record<string, string>
  state: FormState
  repeat: RepeatActions
  scope: FormScope
}

function FormItemView({
  item,
  views,
  labels,
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
        labels={labels}
        errors={errors}
        state={state}
        repeat={repeat}
      />
    )
  if (item.control === 'content')
    return <FormContent content={item} views={views} />
  const name = scope.name(item.key)
  const id = item.id + scope.suffix
  // Rules can make an input required for the answers so far
  const required = item.required || state.required.has(id)
  const props: FormInputViewProps = {
    input: required === item.required ? item : {...item, required},
    id: `form-${item.id}${scope.suffix.replace(':', '-')}`,
    name,
    error: errors[name],
    disabled: state.disabled.has(id),
    views
  }
  const Custom = (views as Record<string, unknown>)[item.type]
  if (typeof Custom === 'function') {
    const View = Custom as ComponentType<FormInputViewProps>
    return <View {...props} />
  }
  return <FormInput {...props} />
}

/**
 * Content between the inputs: the view of its type, or for content without
 * one its `body` field as rich text, eg. the Text block
 */
function FormContent({content, views}: FormContentViewProps) {
  const Custom = (views as Record<string, unknown>)[content.type]
  if (typeof Custom === 'function') {
    const View = Custom as ComponentType<FormContentViewProps>
    return <View content={content} views={views} />
  }
  const {body} = content.data
  return part(
    views.content,
    'div',
    {'data-content': content.type},
    Array.isArray(body) && <RichText doc={body as TextDoc} />
  )
}

interface FormSectionProps {
  section: FormSectionData
  views: FormViews
  labels: FormLabels
  errors: Record<string, string>
  state: FormState
  repeat: RepeatActions
}

function FormSection({
  section,
  views,
  labels,
  errors,
  state,
  repeat
}: FormSectionProps) {
  const context = {views, labels, errors, state, repeat}
  const {key} = section
  if (!section.repeat || !key)
    return part(views.section, 'fieldset', {'data-section': section.type}, [
      part(views.legend, 'legend', {key: 'legend'}, section.label),
      section.help &&
        part(
          views.help,
          'div',
          {key: 'help', 'data-help': ''},
          <RichText doc={section.help} />
        ),
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
        part(
          views.help,
          'div',
          {key: 'help', 'data-help': ''},
          <RichText doc={section.help} />
        ),
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
                  'aria-label': `${labels.remove} ${section.label} ${index + 1}`,
                  onClick: () => repeat.remove(section, item)
                },
                labels.remove
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
          add ?? labels.add
        )
    ]
  )
}

/** The answers with each file replaced by the token of its upload */
async function uploadFiles(
  upload: (file: FormUploadFile) => Promise<PrepareUploadResult>,
  posted: FormData,
  locale?: string | null
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
    const error = await uploadFile(ticket, value, locale)
    if (error) errors[key] = error
    else data.append(key, ticket.token)
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
    items: Array<FormSectionItem>,
    target: Record<string, unknown>,
    name: (key: string) => string
  ) => {
    for (const input of inputsOf(items)) {
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
    input.help &&
    part(
      views.help,
      'div',
      {key: 'help', id: helpId},
      <RichText doc={input.help} />
    )
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
        part(views.choiceControl, 'input', {
          ...control,
          key: 'control',
          id,
          type: 'checkbox',
          defaultChecked: input.initialValue === true
        }),
        ' ',
        // One element for the text, so the choice lays out as control and text
        <span key="text">
          {Array.isArray(input.settings.text) ? (
            // Paragraphs are not allowed in a label
            <RichText doc={input.settings.text} p={<span />} />
          ) : (
            input.label
          )}
          {input.required && <span> *</span>}
        </span>
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
          part(views.choiceControl, 'input', {
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
