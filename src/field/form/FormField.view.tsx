import {
  Badge,
  Button,
  type Key,
  SortableListGroup,
  type SortableListMoveEvent,
  Text
} from '#/components.js'
import {Field} from '#/core/Field.js'
import type {ListRow} from '#/core/ListRow.js'
import type {FieldPath} from '#/core/Validation.js'
import {isEmptyValue, isRecord} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from '#/dashboard/app/ui/DashboardModal.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {useEditor, useFieldNode, useFieldOptions} from '#/dashboard/hooks.js'
import {
  IcBaselineErrorOutline,
  IcRoundCallSplit,
  IcRoundRepeat,
  IcRoundTranslate
} from '#/dashboard/icons.js'
import {useOtherLanguages} from '#/dashboard/app/useMissingLanguages.js'
import {fieldSharingContext} from '#/dashboard/contexts.js'
import {
  type ListFieldBadgesProps,
  ListFieldView,
  type ListValue
} from '#/field/list/ListField.view.js'
import styler from '@alinea/styler'
import {type Atom, atom, useAtomValueRaw, useStore} from 'jotai'
import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState
} from 'react'
import type {FormField} from './FormField.js'
import type {Input} from './FormInput.js'
import {isSharedFormField, textKeys} from './FormShare.js'
import css from './FormField.module.css'
import {FormTranslationAlert} from './FormTranslationAlert.js'
import {
  type FormEntry,
  dependents,
  describeCondition,
  entryLabel,
  moveRow,
  readingOrder,
  withoutRulesOn
} from './FormRules.js'

const styles = styler(css)

export interface FormBuilder {
  /** The inputs editors can add */
  inputs: Record<string, Input>
  /** The form shares its structure between languages */
  shared: boolean
  /** The rows of the outermost form field in reading order */
  order: Atom<Array<FormEntry>>
  /** The first error of each row by its id */
  errors: Atom<Map<string, string>>
  /** The outermost list, to change rules of other rows */
  root: ReactiveNode<Array<ListValue>>
  /** Removes a row, asking first when rules use it */
  remove(row: ListValue, remove: () => void): void
}

/** The form a row or its sheet belongs to, from the outermost form field */
export const FormBuilderContext = createContext<FormBuilder | null>(null)

const none = atom(undefined)

export interface FormFieldViewProps {
  field: FormField
}

export function FormFieldView({field}: FormFieldViewProps) {
  const parent = useContext(FormBuilderContext)
  if (parent) return <FormSectionList field={field} />
  return (
    <FormFieldRoot field={field}>
      <FormFieldList field={field} group="" />
    </FormFieldRoot>
  )
}

/** The inputs of a section, in the editor of the section row */
function FormSectionList({field}: FormFieldViewProps) {
  const editor = useEditor()
  const id = useAtomValueRaw(editor.node.field('_id')) as string
  return <FormFieldList field={field} group={id} />
}

interface FormFieldRootProps {
  field: FormField
  children: ReactNode
}

/** Shares the whole form with its rows, and asks before removing inputs */
function FormFieldRoot({field, children}: FormFieldRootProps) {
  const {inputs} = useFieldOptions(field)
  const node = useFieldNode(field) as ReactiveNode<Array<ListValue>>
  const store = useStore()
  const [removing, setRemoving] = useState<Removal>()
  const rows = useAtomValueRaw(node.value)
  const builder = useMemo<FormBuilder>(() => {
    const order = atom(get => readingOrder(inputs, get(node.value)))
    return {
      inputs,
      shared: Boolean(Field.options(field).shared),
      order,
      errors: atom(get => rowErrors(field, get(node.value))),
      root: node,
      remove(row, remove) {
        const users = dependents(store.get(order), row._id).filter(
          entry => entry.row._id !== row._id
        )
        if (users.length === 0) return remove()
        const self = store.get(order).find(entry => entry.row._id === row._id)
        setRemoving({
          label: self ? entryLabel(self) : 'this input',
          id: row._id,
          users: users.map(entryLabel),
          remove
        })
      }
    }
  }, [field, inputs, node, store])

  // Inputs move into and out of sections, sections stay in the form
  function canMove(key: Key, list: Key) {
    const entry = store.get(builder.order).find(entry => entry.row._id === key)
    return list === '' || entry?.input.control !== 'section'
  }

  function move({key, list, index}: SortableListMoveEvent) {
    const section = list === '' ? undefined : String(list)
    const rows = moveRow(store.get(node.value), String(key), section, index)
    store.set(node.value, rows as Array<ListValue>)
  }

  function finish(removeRules: boolean) {
    if (!removing) return
    removing.remove()
    if (removeRules)
      store.set(
        node.value,
        withoutRulesOn(store.get(node.value), removing.id) as Array<ListValue>
      )
    setRemoving(undefined)
  }

  return (
    <FormBuilderContext.Provider value={builder}>
      <SortableListGroup onMove={move} canMove={canMove}>
        {builder.shared ? (
          <fieldSharingContext.Provider value={isSharedFormField}>
            {children}
          </fieldSharingContext.Provider>
        ) : (
          <>
            <FormTranslationAlert field={field} rows={rows} />
            {children}
          </>
        )}
      </SortableListGroup>
      <FormRemoveModal
        removal={removing}
        onCancel={() => setRemoving(undefined)}
        onRemove={finish}
      />
    </FormBuilderContext.Provider>
  )
}

interface FormFieldListProps {
  field: FormField
  /** The id of the section of the list, empty for the form itself */
  group: string
}

function FormFieldList({field, group}: FormFieldListProps) {
  const builder = useContext(FormBuilderContext)
  return (
    <ListFieldView
      field={field}
      group={group}
      labelField="label"
      badges={FormRowBadges}
      addLabel="Add input"
      onRemove={builder?.remove}
    />
  )
}

export interface FormOptionsViewProps {
  field: Field<Array<ListRow>>
}

/** The options of a choice, each with the key its answers are stored by */
export function FormOptionsView({field}: FormOptionsViewProps) {
  return <ListFieldView field={field} badges={FormOptionKey} />
}

function FormOptionKey({row}: ListFieldBadgesProps) {
  const label = useAtomValueRaw(row.field('label'))
  const value = useAtomValueRaw(row.field('value'))
  // Like the key field, it follows the label until it is changed
  const key =
    typeof value === 'string' && value
      ? value
      : slugify(typeof label === 'string' ? label : '')
  if (!key) return null
  // Cut off at the end of the input, so the title shows all of it
  return <span title={`Key: ${key}`}>{key}</span>
}

interface Removal {
  id: string
  label: string
  users: Array<string>
  remove: () => void
}

interface FormRemoveModalProps {
  removal?: Removal
  onCancel: () => void
  onRemove: (removeRules: boolean) => void
}

function FormRemoveModal({removal, onCancel, onRemove}: FormRemoveModalProps) {
  return (
    <DashboardModal
      open={Boolean(removal)}
      onOpenChange={open => {
        if (!open) onCancel()
      }}
    >
      {removal && (
        <DashboardModalDialog label={`Delete ${removal.label}?`}>
          <DashboardModalContent>
            <Text as="p">
              {removal.users.length === 1
                ? `${removal.users[0]} depends on ${removal.label}.`
                : `${removal.users.length} inputs depend on ${removal.label}: ${list(removal.users)}.`}{' '}
              {removal.users.length === 1
                ? 'Its rules stop'
                : 'Their rules stop'}{' '}
              working when {removal.label} is deleted.
            </Text>
          </DashboardModalContent>
          <DashboardModalFooter>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => onRemove(false)}>
              Keep the rules
            </Button>
            <Button color="destructive" onClick={() => onRemove(true)}>
              Delete and remove rules
            </Button>
          </DashboardModalFooter>
        </DashboardModalDialog>
      )}
    </DashboardModal>
  )
}

function list(names: Array<string>): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function FormRowBadges({row}: ListFieldBadgesProps) {
  const builder = useContext(FormBuilderContext)
  const id = useAtomValueRaw(row.field('_id')) as string
  const required = useAtomValueRaw(row.field('required'))
  const type = useAtomValueRaw(row.field('_type')) as string
  const value = useAtomValueRaw(row.value) as Record<string, unknown>
  const others = useOtherLanguages(id)
  const input = builder?.inputs[type]
  // Texts another language filled in that this one did not
  const untranslated = input
    ? others
        .filter(({record}) =>
          [...textKeys(input)].some(
            key => isEmptyValue(value?.[key]) && !isEmptyValue(record[key])
          )
        )
        .map(({locale}) => locale.toUpperCase())
    : []
  const repeat = useAtomValueRaw(row.field('repeat'))
  const min = useAtomValueRaw(row.field('min'))
  const max = useAtomValueRaw(row.field('max'))
  const info = useAtomValueRaw(
    useMemo(
      () =>
        builder
          ? atom(get => {
              const order = get(builder.order)
              const byId = new Map(order.map(entry => [entry.row._id, entry]))
              const self = byId.get(id)
              const users = dependents(order, id).filter(
                entry => entry.row._id !== id
              )
              return {
                error: get(builder.errors).get(id),
                shown: self && describeCondition(self.row.showWhen, byId),
                disabled: self && describeCondition(self.row.disableWhen, byId),
                required: self && describeCondition(self.row.requireWhen, byId),
                controls: users.length
              }
            })
          : none,
      [builder, id]
    )
  )
  return (
    <>
      {untranslated.length > 0 && (
        <Badge
          size="sm"
          icon={IcRoundTranslate}
          title={`Filled in in ${untranslated.join(', ')}`}
        >
          Not translated
        </Badge>
      )}
      {required === true && <Badge size="sm">Required</Badge>}
      {repeat === true && (
        <Badge size="sm" icon={IcRoundRepeat}>
          {repeatLabel(min, max)}
        </Badge>
      )}
      {info?.shown && (
        <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
          Shown if {info.shown}
        </Badge>
      )}
      {info?.required && (
        <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
          Required if {info.required}
        </Badge>
      )}
      {info?.disabled && (
        <Badge size="sm" color="primary" icon={IcRoundCallSplit}>
          Disabled if {info.disabled}
        </Badge>
      )}
      {Boolean(info?.controls) && (
        <Badge size="sm" icon={IcRoundCallSplit}>
          Controls {info!.controls} {info!.controls === 1 ? 'input' : 'inputs'}
        </Badge>
      )}
      {info?.error && (
        <Badge
          size="sm"
          color="destructive"
          icon={IcBaselineErrorOutline}
          title={info.error}
          className={styles.FormRowBadges.error()}
        >
          {info.error}
        </Badge>
      )}
    </>
  )
}

/** How often a repeatable section is filled in, eg. "Repeats 1 to 5 times" */
function repeatLabel(min: unknown, max: unknown): string {
  const fewest = typeof min === 'number' ? min : 1
  if (typeof max !== 'number')
    return fewest > 1 ? `Repeats at least ${fewest} times` : 'Repeats'
  if (max === fewest) return `Repeats ${max} times`
  return `Repeats ${fewest} to ${max} times`
}

// Most fields of an input are in its sheet, its row shows what is wrong
function rowErrors(field: FormField, value: unknown): Map<string, string> {
  const result = new Map<string, string>()
  const errors = Field.nestedErrors(field, value, {
    path: [],
    labels: [],
    scopes: []
  })
  for (const {path, labels, message} of errors) {
    const id = rowId(value, path)
    if (!id || result.has(id)) continue
    // Errors of rules name the input they use, others name their field
    const rule = ['showWhen', 'disableWhen', 'requireWhen'].includes(
      String(path.at(-1))
    )
    result.set(id, rule ? message : `${labels.at(-1)}: ${message}`)
  }
  return result
}

/** The innermost input or section the path leads to */
function rowId(rows: unknown, path: FieldPath): string | undefined {
  let id: string | undefined
  for (let i = 0; i < path.length; i += 2) {
    const row = Array.isArray(rows) ? rows[path[i] as number] : undefined
    if (!isRecord(row)) break
    id = row._id as string
    if (path[i + 1] !== 'inputs') break
    rows = row.inputs
  }
  return id
}
