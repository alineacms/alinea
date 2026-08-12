import {
  Button,
  Label,
  Select,
  SelectItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup
} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {Reference} from '#/core/Reference.js'
import {Schema} from '#/core/Schema.js'
import {Type, type as createType} from '#/core/Type.js'
import {createEntryAtom} from '#/dashboard/atoms/create.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import {entry as entryField} from '#/field/link.js'
import type {LinkField} from '#/field/link/LinkField.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom, type WritableAtom} from 'jotai'
import {
  Suspense,
  useMemo,
  useState,
  type FormEvent,
  type SetStateAction
} from 'react'
import {IcRoundFirstPage, IcRoundLastPage} from '../../icons.js'
import {NodeEditor} from '../EntryFields.js'
import {
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter,
  useDashboardModal
} from '../ui/DashboardModal.js'
import css from './CreateEntry.module.css'

const styles = styler(css)

type LinkFieldValueAtom = WritableAtom<
  EntryReference | null,
  [SetStateAction<EntryReference | null>],
  void
>

interface TypeOption {
  id: string
  label: string
}

interface LinkEditor {
  node: ReactiveNode<object>
  type: Type
  value: LinkFieldValueAtom
}

function entryReference(id: string, key: string): EntryReference {
  return {
    [Reference.id]: key,
    [Reference.type]: 'entry',
    [EntryReference.entry]: id
  }
}

function entryIdOf(value: EntryReference | null | undefined) {
  return EntryReference.isEntryReference(value)
    ? value[EntryReference.entry]
    : undefined
}

function buildTypeOptions(
  schema: Record<string, Type>,
  types: Array<string>
): Array<TypeOption> {
  return types
    .map(type => {
      const schemaType = schema[type]
      if (!schemaType || Type.isHidden(schemaType)) return null
      return {id: type, label: getType(schemaType).label}
    })
    .filter((option): option is TypeOption => option !== null)
}

function createLinkEditor(
  key: string,
  field: LinkField<EntryReference, unknown>,
  initialValue?: EntryReference | null
): LinkEditor {
  const formType = createType(`${key} link`, {fields: {[key]: field}})
  const value = Type.initialValue(formType) as Record<string, unknown>
  if (initialValue !== undefined) value[key] = initialValue
  const node = new ReactiveNode(value as object)
  return {
    node,
    type: formType,
    value: node.field(key) as LinkFieldValueAtom
  }
}

function CreateEntryLoading() {
  return (
    <DashboardModalDialog
      aria-label="Create entry"
      variant="explorer"
      isLoading
    />
  )
}

function CreateEntryForm() {
  const modal = useDashboardModal()
  const {page, root} = useDashboardContext()
  const createEntry = useSetAtom(createEntryAtom)
  const config = useAtomValue(configAtom).schema
  const policy = useAtomValue(policyAtom)
  const {locale} = page
  const treeItems = useAtomValue(root.treeItems(locale))
  const rootData = useAtomValue(root.data)
  const initialParentId = useMemo(() => {
    if (!page.entry) return undefined
    const current = treeItems.find(item => item.id === page.entry)
    if (!current) return undefined
    const type = config[current.type]
    return type && Type.isContainer(type)
      ? current.id
      : (current.parentId ?? undefined)
  }, [config, page.entry, treeItems])
  const [title, setTitle] = useState('')
  const [selectedTypeOverride, setSelectedType] = useState<string | null>(null)
  const [insertOrder, setInsertOrder] = useState<'first' | 'last'>('last')
  const [isCreating, setIsCreating] = useState(false)
  const containerTypes = useMemo(
    () =>
      Object.entries(config)
        .filter(([, type]) => Type.isContainer(type) && !Type.isHidden(type))
        .map(([name]) => name),
    [config]
  )

  const parent = useMemo(() => {
    const field = entryField('Parent', {
      condition: {_type: {in: containerTypes}},
      initialValue: initialParentId
        ? entryReference(initialParentId, 'parent')
        : null!,
      location: {workspace: root.workspace, root: root.key},
      title: 'Select parent'
    }) as LinkField<EntryReference, unknown>
    return createLinkEditor(
      'parent',
      field,
      initialParentId ? entryReference(initialParentId, 'parent') : null
    )
  }, [containerTypes, initialParentId, root.key, root.workspace])
  const parentValue = useAtomValue(parent.value)
  const parentId = entryIdOf(parentValue)
  const parentItem = treeItems.find(item => item.id === parentId)
  const parentType = parentItem ? config[parentItem.type] : undefined
  const allowed = parentType
    ? Schema.contained(config, Type.contains(parentType))
    : Schema.contained(config, rootData.contains ?? [])
  const parentIds = parentId
    ? [
        parentId,
        ...treeItems
          .filter(item => {
            let current = parentItem
            while (current?.parentId) {
              if (current.parentId === item.id) return true
              current = treeItems.find(
                candidate => candidate.id === current?.parentId
              )
            }
            return false
          })
          .map(item => item.id)
      ]
    : []
  const typeOptions = buildTypeOptions(config, allowed).filter(option =>
    policy.canCreate({
      workspace: root.workspace,
      root: root.key,
      locale,
      parents: parentIds,
      type: option.id
    })
  )
  const selectedType =
    selectedTypeOverride &&
    typeOptions.some(option => option.id === selectedTypeOverride)
      ? selectedTypeOverride
      : (typeOptions[0]?.id ?? null)

  const copyFrom = useMemo(() => {
    const field = entryField('Copy content from', {
      condition: {_type: selectedType ?? ''},
      location: {workspace: root.workspace, root: root.key},
      readOnly: !selectedType,
      title: 'Select entry'
    }) as LinkField<EntryReference, unknown>
    return createLinkEditor('copyFrom', field)
  }, [root.key, root.workspace, selectedType])
  const copyFromValue = useAtomValue(copyFrom.value)
  const copyFromId = entryIdOf(copyFromValue)
  const showInsertOrder = parentType
    ? Type.insertOrder(parentType) === 'free'
    : true

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (isCreating || !selectedType || !nextTitle) return
    setIsCreating(true)
    try {
      await createEntry({
        workspace: root.workspace,
        root: root.key,
        locale,
        parentId,
        type: selectedType,
        title: nextTitle,
        copyFrom: copyFromId,
        insertOrder: showInsertOrder ? insertOrder : undefined
      })
      modal.close()
    } finally {
      setIsCreating(false)
    }
  }

  const canCreate = Boolean(selectedType && title.trim())

  return (
    <DashboardModalDialog
      aria-label="Create entry"
      variant="explorer"
      label="Create entry"
    >
      <form onSubmit={onSubmit} id="submit">
        <DashboardModalContent>
          <TextField
            autoFocus
            value={title}
            onChange={setTitle}
            label="Title"
            isRequired
          />

          <Select
            label="Type"
            selectedKey={selectedType}
            onSelectionChange={key => {
              setSelectedType(key ? String(key) : null)
            }}
            isRequired
          >
            {typeOptions.map(option => (
              <SelectItem id={option.id} key={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </Select>

          {typeOptions.length === 0 && (
            <p className={styles.CreateEntry.message()}>
              No entry types are available at this location.
            </p>
          )}

          <div className={styles.CreateEntry.parentRow()}>
            <div className={styles.CreateEntry.parentField()}>
              <NodeEditor node={parent.node} type={parent.type} />
            </div>
            {showInsertOrder && (
              <Label
                label="Insert"
                className={styles.CreateEntry.insertOrder()}
              >
                <ToggleButtonGroup
                  aria-label="Insert"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[insertOrder]}
                  onSelectionChange={key => {
                    if (key.has('first')) setInsertOrder('first')
                    else if (key.has('last')) setInsertOrder('last')
                  }}
                >
                  <ToggleButton id="first">
                    <IcRoundFirstPage data-slot="icon" /> First
                  </ToggleButton>
                  <ToggleButton id="last">
                    <IcRoundLastPage data-slot="icon" /> Last
                  </ToggleButton>
                </ToggleButtonGroup>
              </Label>
            )}
          </div>

          <NodeEditor node={copyFrom.node} type={copyFrom.type} />
        </DashboardModalContent>
      </form>

      <DashboardModalFooter>
        <Button type="button" appearance="outline" onPress={modal.close}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="submit"
          intent="primary"
          isDisabled={!canCreate}
          isPending={isCreating}
        >
          Create entry
        </Button>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}

export function CreateEntry() {
  return (
    <Suspense fallback={<CreateEntryLoading />}>
      <CreateEntryForm />
    </Suspense>
  )
}
