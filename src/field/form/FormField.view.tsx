import {Badge, Button, Text} from '#/components.js'
import {Field} from '#/core/Field.js'
import type {FieldPath} from '#/core/Validation.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from '#/dashboard/app/ui/DashboardModal.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {useFieldNode, useFieldOptions} from '#/dashboard/hooks.js'
import {IcRoundCallSplit, IcRoundRepeat} from '#/dashboard/icons.js'
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
  useCallback,
  useContext,
  useMemo,
  useState
} from 'react'
import type {FormField} from './FormField.js'
import css from './FormField.module.css'
import {defaults} from './FormInputs.js'
import {
  type FormEntry,
  dependents,
  describeCondition,
  entryLabel,
  readingOrder,
  withoutRulesOn
} from './FormRules.js'

const styles = styler(css)

const builtIn = new Set<unknown>(Object.values(defaults))

export interface FormBuilder {
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
  const view = <FormFieldList field={field} />
  if (parent) return view
  return <FormFieldRoot field={field}>{view}</FormFieldRoot>
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
  const builder = useMemo<FormBuilder>(() => {
    const order = atom(get => readingOrder(inputs, get(node.value)))
    return {
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
      {children}
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
}

function FormFieldList({field}: FormFieldListProps) {
  const {inputs} = useFieldOptions(field)
  const builder = useContext(FormBuilderContext)
  const ownInputs = Object.values(inputs).some(input => !builtIn.has(input))
  const typeGroup = useCallback(
    (id: string) => {
      if (!ownInputs) return undefined
      return builtIn.has(inputs[id]) ? 'Inputs' : 'This project'
    },
    [inputs, ownInputs]
  )
  return (
    <ListFieldView
      field={field}
      labelField="label"
      badges={FormRowBadges}
      addLabel="Add input"
      typeGroup={typeGroup}
      onRemove={builder?.remove}
    />
  )
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
                controls: users.length
              }
            })
          : none,
      [builder, id]
    )
  )
  return (
    <>
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
        <Text
          size="sm"
          color="destructive"
          truncate
          title={info.error}
          className={styles.FormRowBadges.error()}
        >
          {info.error}
        </Text>
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
    const rule = path.at(-1) === 'showWhen' || path.at(-1) === 'disableWhen'
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
