import {
  Button,
  Label,
  Select,
  SelectItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup
} from '#/components.js'
import {Entry} from '#/core/Entry.js'
import {getRoot, getType} from '#/core/Internal.js'
import {MediaLibrary} from '#/core/media/MediaTypes.js'
import {Reference} from '#/core/Reference.js'
import {Permission} from '#/core/Role.js'
import {Schema} from '#/core/Schema.js'
import {Type, type as createType} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {slugify} from '#/core/util/Slugs.js'
import {entry as entryField} from '#/field/link.js'
import type {LinkField} from '#/field/link/LinkField.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom, type WritableAtom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {
  Suspense,
  useMemo,
  useState,
  type FormEvent,
  type SetStateAction
} from 'react'
import {IcRoundFirstPage, IcRoundLastPage} from '../../icons.js'
import type {DashboardCreateEntryRequest} from '../../atoms/dashboard.js'
import {ReactiveNode} from '../../atoms/entry/editor.js'
import {entryAtoms} from '../../atoms/entry.js'
import type {ExplorerLocation} from '../../atoms/explorer.js'
import {graphAtom} from '../../atoms/graph.js'
import {routeAtom} from '../../atoms/routing.js'
import {policyAtom, userAtom} from '../../atoms/user.js'
import {selectedRootAtom, selectedWorkspaceAtom} from '../../atoms/routing.js'
import {configAtom, workspaceAtoms} from '../../atoms/config.js'
import {NodeEditor} from '../Editor.js'
import {
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter,
  useDashboardModal
} from '../ui/DashboardModal.js'
import css from './CreateEntry.module.css'

const styles = styler(css)

const createEntryAtom = atom(
  null,
  async (get, set, request: DashboardCreateEntryRequest) => {
    const config = get(configAtom)
    const db = get(graphAtom)
    const policy = get(policyAtom)
    const type = config.schema[request.type]
    assert(type, `Type "${request.type}" not found in config`)

    const title = request.title.trim()
    assert(title, 'Title is required')

    const copiedData = request.copyFrom
      ? await db.first({
          select: Entry.data,
          id: request.copyFrom,
          locale: request.locale,
          status: 'preferPublished'
        })
      : undefined

    const parent = request.parentId
      ? await db.first({
          select: {type: Entry.type, parents: Entry.parents},
          id: request.parentId,
          status: 'preferDraft'
        })
      : undefined
    const parentType = parent ? config.schema[parent.type] : undefined
    const parentInsertOrder = parentType && Type.insertOrder(parentType)
    policy.assert(Permission.Create, {
      workspace: request.workspace,
      root: request.root,
      locale: request.locale,
      type: request.type,
      parents: request.parentId
        ? [request.parentId, ...(parent?.parents ?? [])]
        : []
    })

    const user = await get(userAtom)
    const initialData = Type.withInitialValue(type, {
      ...Type.initialValue(type),
      ...copiedData,
      title,
      path: slugify(title)
    })
    const data = Type.beforeSave(type, initialData, {
      action: 'create',
      user,
      now: new Date()
    })

    const created = await db.create({
      type,
      workspace: request.workspace,
      root: request.root,
      parentId: request.parentId,
      locale: request.locale,
      status:
        type === MediaLibrary || !config.enableDrafts ? 'published' : 'draft',
      insertOrder:
        parentInsertOrder && parentInsertOrder !== 'free'
          ? parentInsertOrder
          : request.insertOrder,
      set: data
    })

    set(routeAtom, {
      workspace: request.workspace,
      root: request.root,
      entry: created._id,
      locale: request.locale ?? undefined
    })

    return created
  }
)

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

const initialLocationAtom = atom(async get => {
  const selectedWorkspace = get(selectedWorkspaceAtom)
  const selectedRoot = get(selectedRootAtom)
  const route = get(routeAtom)

  if (!route.entry) {
    return {
      workspace: selectedWorkspace,
      root: selectedRoot
    }
  }

  const entry = entryAtoms(route.entry)
  const {data} = get(entry.data)
  if (!data) {
    return {
      workspace: selectedWorkspace,
      root: selectedRoot
    }
  }
  const type = get(data.type)
  const parentId = get(data.entryData).parentId ?? undefined

  return {
    workspace: selectedWorkspace,
    root: selectedRoot,
    parentId: Type.isContainer(type) ? route.entry : parentId
  }
})

function createLinkEditor(
  key: string,
  field: LinkField<EntryReference, unknown>,
  initialValue?: EntryReference | null
): LinkEditor {
  const formType = createType(`${key} link`, {
    fields: {
      [key]: field
    }
  })
  const value = Type.initialValue(formType) as Record<string, unknown>
  if (initialValue !== undefined) value[key] = initialValue
  const node = new ReactiveNode(value as object)
  return {
    node,
    type: formType,
    value: node.field(key) as LinkFieldValueAtom
  }
}

function typeOptionsAtom(
  location: ExplorerLocation,
  locale: string | null,
  parentId: string | undefined
) {
  return unwrap(
    atom(async get => {
      const config = get(configAtom)
      const db = get(graphAtom)
      const policy = get(policyAtom)
      const rootKey = location.root
      let allowed = [] as Array<string>
      let parentIds = [] as Array<string>

      if (parentId) {
        const parent = await db.first({
          select: {type: Entry.type, parents: Entry.parents},
          id: parentId,
          status: 'preferDraft'
        })
        const parentType = parent && config.schema[parent.type]
        parentIds = [parentId, ...(parent?.parents ?? [])]
        allowed = parentType
          ? Schema.contained(config.schema, Type.contains(parentType))
          : []
      } else {
        const rootConfig =
          rootKey && config.workspaces[location.workspace]?.[rootKey]
        allowed = rootConfig
          ? Schema.contained(config.schema, getRoot(rootConfig).contains ?? [])
          : []
      }

      return buildTypeOptions(
        config.schema,
        allowed.filter(type => {
          return policy.canCreate({
            workspace: location.workspace,
            root: rootKey,
            locale,
            parents: parentIds,
            type
          })
        })
      )
    }),
    previous => previous ?? []
  )
}

function insertOrderVisibleAtom(parentId: string | undefined) {
  return unwrap(
    atom(async get => {
      if (!parentId) return true
      const config = get(configAtom)
      const db = get(graphAtom)
      const parent = await db.first({
        select: {type: Entry.type},
        id: parentId,
        status: 'preferDraft'
      })
      const parentType = parent ? config.schema[parent.type] : undefined
      return parentType ? Type.insertOrder(parentType) === 'free' : false
    }),
    previous => previous ?? false
  )
}

const containerTypesAtom = atom(get => {
  const config = get(configAtom)
  return (Object.entries(config.schema) as Array<[string, Type]>)
    .filter(([, schemaType]) => {
      return Type.isContainer(schemaType) && !Type.isHidden(schemaType)
    })
    .map(([type]) => type)
})

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
  const createEntry = useSetAtom(createEntryAtom)
  const initial = useAtomValue(initialLocationAtom)
  const [title, setTitle] = useState('')
  const [selectedTypeOverride, setSelectedType] = useState<string | null>(null)
  const [insertOrder, setInsertOrder] = useState<'first' | 'last'>('last')
  const [isCreating, setIsCreating] = useState(false)
  const workspace = workspaceAtoms(initial.workspace)
  const roots = useAtomValue(workspace.roots)
  const rootKey = initial.root ?? roots[0]
  assert(rootKey, 'No root selected')
  const root = workspace.root(rootKey)
  const locale = useAtomValue(root.selectedLocale)
  const containerTypes = useAtomValue(containerTypesAtom)

  const parent = useMemo(() => {
    const field = entryField('Parent', {
      condition: {_type: {in: containerTypes}},
      initialValue: initial.parentId
        ? entryReference(initial.parentId, 'parent')
        : null!,
      location: {workspace: initial.workspace, root: rootKey},
      title: 'Select parent'
    }) as LinkField<EntryReference, unknown>
    return createLinkEditor(
      'parent',
      field,
      initial.parentId ? entryReference(initial.parentId, 'parent') : null
    )
  }, [containerTypes, initial.parentId, initial.workspace, rootKey])
  const parentValue = useAtomValue(parent.value)
  const parentId = entryIdOf(parentValue)
  const location = useMemo(
    () => ({
      workspace: initial.workspace,
      root: rootKey,
      parentId
    }),
    [initial.workspace, parentId, rootKey]
  )

  const typeOptions = useAtomValue(
    useMemo(
      () => typeOptionsAtom(location, locale, parentId),
      [locale, location, parentId]
    )
  )
  const selectedType =
    selectedTypeOverride &&
    typeOptions.some(option => option.id === selectedTypeOverride)
      ? selectedTypeOverride
      : (typeOptions[0]?.id ?? null)

  const copyFrom = useMemo(() => {
    const field = entryField('Copy content from', {
      condition: {_type: selectedType ?? ''},
      location: {workspace: initial.workspace, root: rootKey},
      readOnly: !selectedType,
      title: 'Select entry'
    }) as LinkField<EntryReference, unknown>
    return createLinkEditor('copyFrom', field)
  }, [initial.workspace, rootKey, selectedType])
  const copyFromValue = useAtomValue(copyFrom.value)
  const copyFromId = entryIdOf(copyFromValue)

  const showInsertOrder = useAtomValue(
    useMemo(() => insertOrderVisibleAtom(parentId), [parentId])
  )

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (isCreating || !selectedType || !nextTitle) return

    setIsCreating(true)
    try {
      await createEntry({
        workspace: location.workspace,
        root: rootKey,
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
