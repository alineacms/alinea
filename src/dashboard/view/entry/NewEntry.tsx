import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {EntryStatus} from 'alinea/core/EntryRow'
import {createId} from 'alinea/core/Id'
import {MutationType} from 'alinea/core/Mutation'
import {Reference} from 'alinea/core/Reference'
import {Schema} from 'alinea/core/Schema'
import {track} from 'alinea/core/Tracker'
import {Type, type} from 'alinea/core/Type'
import {
  entryChildrenDir,
  entryFileName,
  entryFilepath,
  entryUrl
} from 'alinea/core/util/EntryFilenames'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {dirname} from 'alinea/core/util/Paths'
import {slugify} from 'alinea/core/util/Slugs'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useLocation, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {Modal} from 'alinea/dashboard/view/Modal'
import {entry, EntryLink} from 'alinea/field/link'
import {select, SelectField} from 'alinea/field/select'
import {text} from 'alinea/field/text'
import {entryPicker} from 'alinea/picker/entry/EntryPicker'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {children, parents} from 'alinea/query'
import {Button, Loader} from 'alinea/ui'
import {Link} from 'alinea/ui/Link'
import {useAtomValue, useSetAtom} from 'jotai'
import {FormEvent, Suspense, useEffect, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {changedEntriesAtom, graphAtom, useMutate} from '../../atoms/DbAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './NewEntry.module.scss'

const styles = styler(css)

const parentData = {
  id: Entry.id,
  type: Entry.type,
  path: Entry.path,
  url: Entry.url,
  level: Entry.level,
  parent: Entry.parentId,
  parentPaths: parents({
    select: Entry.path
  }),
  firstChildIndex: children({
    take: 1,
    select: Entry.index,
    orderBy: {asc: Entry.index, caseSensitive: true}
  }),
  lastChildIndex: children({
    take: 1,
    select: Entry.index,
    orderBy: {desc: Entry.index, caseSensitive: true}
  })
}

const titleField = text('Title', {autoFocus: true})

function NewEntryForm({parentId}: NewEntryProps) {
  const config = useConfig()
  const locale = useLocale()
  const graph = useAtomValue(graphAtom)
  const {data: requestedParent} = useQuery(
    ['parent-req', parentId],
    async () => {
      return parentId
        ? graph.first({
            select: parentData,
            id: parentId,
            locale,
            status: 'preferDraft'
          })
        : null
    },
    {suspense: true, keepPreviousData: true, staleTime: 0}
  )
  const preselectedId =
    requestedParent &&
    (Type.isContainer(config.schema[requestedParent.type])
      ? requestedParent.id
      : requestedParent.parent)
  const {pathname} = useLocation()
  const nav = useNav()
  const navigate = useNavigate()
  const mutate = useMutate()
  const {name: workspace} = useWorkspace()
  const containerTypes = entries(config.schema)
    .filter(([, type]) => {
      return Type.isContainer(type!)
    })
    .map(pair => pair[0])
  const root = useRoot()
  const parentField = useMemo(() => {
    return entry('Parent', {
      location: {workspace, root: root.name},
      condition: {_type: {in: containerTypes}},
      enableNavigation: true,
      initialValue: preselectedId
        ? {
            [Reference.id]: 'parent',
            [Reference.type]: 'entry',
            [EntryReference.entry]: preselectedId
          }
        : undefined
    })
  }, [])

  async function allowedTypes(parentId?: string): Promise<Array<string>> {
    if (!parentId) {
      return root.contains
        ? Schema.contained(config.schema, root.contains)
        : keys(config.schema)
    } else {
      const parent = parentId
        ? await graph.get({
            select: parentData,
            id: parentId,
            status: 'preferDraft'
          })
        : null
      const parentType = parent && config.schema[parent.type]
      if (parentType)
        return Schema.contained(config.schema, Type.contains(parentType))
      return keys(config.schema)
    }
  }

  const typeField = useMemo(() => {
    const typeField: SelectField<string> = select('Select type', {
      options: {}
    }) as any
    return track.options(typeField, async get => {
      const selectedParent = get(parentField)
      const parentId = selectedParent?.[EntryReference.entry]
      const types: Array<string> = await allowedTypes(parentId)
      return {
        options: fromEntries(
          types
            .map(key => {
              return [key, config.schema[key]] as const
            })
            .filter(row => row[1])
            .map(([key, type]) => {
              return [key, (Type.label(type) || key) as string]
            })
        )
      }
    })
  }, [])

  const insertOrderField = useMemo(() => {
    const insertOrderField: SelectField<'first' | 'last'> = select(
      'Insert order',
      {
        initialValue: 'last',
        options: {
          first: 'At the top of the list',
          last: 'At the bottom of the list'
        }
      }
    )
    return track.options(insertOrderField, async get => {
      const selectedParent = get(parentField)
      const parentId = selectedParent?.[EntryReference.entry]
      const parent = await graph.get({
        select: {
          type: Entry.type
        },
        id: parentId,
        status: 'preferDraft'
      })
      const parentType = parent && config.schema[parent.type]
      const parentInsertOrder = Type.insertOrder(parentType)
      return {
        hidden: parentInsertOrder !== 'free'
      }
    })
  }, [])

  const copyFromField = useMemo(() => {
    const copyFromField = entry('Copy content from')
    return track.options(copyFromField, get => {
      const type = get(typeField)!
      return {
        readOnly: !type,
        pickers: {
          entry: entryPicker({
            condition: {_type: type},
            title: 'Copy content from',
            max: 1,
            selection: EntryLink
          })
        }
      }
    })
  }, [])

  const [isCreating, setIsCreating] = useState(false)
  const updateEntries = useSetAtom(changedEntriesAtom)

  const formType = useMemo(
    () =>
      type('New entry', {
        fields: {
          parent: parentField,
          title: titleField,
          type: typeField,
          order: insertOrderField,
          copyFrom: copyFromField
        }
      }),
    []
  )
  const form = useForm(formType)

  const parentAtoms = form.fieldInfo(parentField)
  const typeAtoms = form.fieldInfo(typeField)
  const copyFromAtoms = form.fieldInfo(copyFromField)
  const selectedType = useAtomValue(typeAtoms.value)
  const selectedParent = useAtomValue(parentAtoms.value)

  useEffect(() => {
    allowedTypes(selectedParent?.[EntryReference.entry]).then(types => {
      if (types.length > 0) typeAtoms.mutator(types[0])
    })
  }, [selectedParent])

  useEffect(() => {
    copyFromAtoms.mutator.replace(undefined!)
  }, [selectedType])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const {title, type: selected} = form.data()
    if (!selected || !title) return
    setIsCreating(true)
    const path = slugify(title)
    const id = createId()
    const data = {
      workspace,
      root: root.name,
      locale: locale ?? null,
      path,
      status: config.enableDrafts ? EntryStatus.Draft : EntryStatus.Published
    }
    const parentId = form.data().parent?.[EntryReference.entry]
    const parent = parentId
      ? await graph.first({
          select: parentData,
          id: parentId,
          locale: locale,
          status: 'preferPublished'
        })
      : null
    const parentType = parent && config.schema[parent.type]
    const parentPaths = parent ? parent.parentPaths.concat(parent.path) : []
    const filePath = entryFilepath(config, data, parentPaths)
    const childrenDir = entryChildrenDir(config, data, parentPaths)
    const parentDir = dirname(filePath)
    const entryType = config.schema[selected]!
    const url = entryUrl(entryType, {...data, parentPaths})
    const copyFrom = form.data().copyFrom?.[EntryReference.entry]
    const entryData = copyFrom
      ? await graph.first({
          select: Entry.data,
          id: copyFrom,
          status: 'preferPublished'
        })
      : Type.initialValue(entryType)

    const parentInsertOrder = parentType ? Type.insertOrder(parentType) : 'free'
    let index = generateKeyBetween(null, parent?.firstChildIndex[0] || null)
    if (
      parentInsertOrder === 'last' ||
      (parentInsertOrder === 'free' && form.data().order === 'last')
    ) {
      index = generateKeyBetween(parent?.lastChildIndex[0] || null, null)
    }

    const entry = await createEntryRow(config, {
      id: id,
      ...data,
      filePath,
      type: selected,
      path,
      title,
      url,
      index,
      parentId: parent?.id ?? null,
      seeded: null,
      level: parent ? parent.level + 1 : 0,
      parentDir: parentDir,
      childrenDir: childrenDir,
      active: true,
      main: false,
      data: {...entryData, title, path},
      searchableText: ''
    })
    return mutate([
      {
        type: MutationType.Create,
        entryId: entry.id,
        locale: entry.locale,
        entry,
        file: entryFileName(config, data, parentPaths)
      }
    ]).then(() => {
      setIsCreating(false)
      navigate(nav.entry({id: entry.id}))
      if (parent) updateEntries([parent.id])
    })
  }
  return (
    <form
      onSubmit={handleCreate}
      className={styles.form({loading: isCreating})}
    >
      {isCreating && <Loader absolute />}
      <InputForm border={false} form={form} />
      <div className={styles.root.footer()}>
        <Link href={pathname} className={styles.root.footer.link()}>
          Cancel
        </Link>
        <Button>Create</Button>
      </div>
    </form>
  )
}

export type NewEntryProps = {parentId?: string}

export function NewEntry({parentId}: NewEntryProps) {
  const navigate = useNavigate()
  const {pathname} = useLocation()
  function handleClose() {
    navigate(pathname)
  }
  return (
    <Modal open onClose={handleClose} className={styles.root()}>
      <Suspense fallback={<Loader />}>
        <NewEntryForm parentId={parentId} />
      </Suspense>
    </Modal>
  )
}
