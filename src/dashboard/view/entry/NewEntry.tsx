import styler from '@alinea/styler'
import {Entry} from 'alinea/core/Entry'
import {EntryPhase} from 'alinea/core/EntryRow'
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
import {EntryLink, entry} from 'alinea/field/link'
import {select} from 'alinea/field/select'
import {text} from 'alinea/field/text'
import {entryPicker} from 'alinea/picker/entry/EntryPicker'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
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
  id: Entry.entryId,
  i18nId: Entry.i18nId,
  type: Entry.type,
  path: Entry.path,
  url: Entry.url,
  level: Entry.level,
  parent: Entry.parent,
  parentPaths: {
    parents: {},
    select: Entry.path
  },
  childrenIndex: {
    first: true as const,
    children: {},
    select: Entry.index,
    orderBy: {asc: Entry.index}
  }
}

const titleField = text('Title', {autoFocus: true})

function NewEntryForm({parentId}: NewEntryProps) {
  const config = useConfig()
  const graph = useAtomValue(graphAtom)
  const {data: requestedParent} = useQuery(
    ['parent-req', parentId],
    async () => {
      return graph.preferDraft.query({
        get: true,
        select: parentData,
        filter: {_id: parentId}
      })
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
  const locale = useLocale()
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
      location: {
        workspace,
        root: root.name
      },
      condition: Entry.type.isIn(containerTypes),
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
      const parent = await graph.preferDraft.query({
        get: true,
        select: parentData,
        filter: {_id: parentId}
      })
      const parentType = parent && config.schema[parent.type]
      if (parentType)
        return Schema.contained(config.schema, Type.contains(parentType))
      return keys(config.schema)
    }
  }

  const typeField = useMemo(() => {
    const typeField = select<Record<string, any>>('Select type', {
      options: {}
    })
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

  const copyFromField = useMemo(() => {
    const copyFromField = entry('Copy content from')
    return track.options(copyFromField, get => {
      const type = get(typeField)!
      return {
        readOnly: !type,
        pickers: {
          entry: entryPicker({
            condition: Entry.type.is(type),
            withNavigation: false,
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
      type({
        fields: {
          parent: parentField,
          title: titleField,
          type: typeField,
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
    const entryId = createId()
    const data = {
      workspace,
      root: root.name,
      locale: locale ?? null,
      path,
      phase: config.enableDrafts ? EntryPhase.Draft : EntryPhase.Published
    }
    const parentId = form.data().parent?.[EntryReference.entry]
    const parent = await graph.preferPublished.query({
      first: true,
      select: parentData,
      filter: {_id: parentId}
    })
    const parentPaths = parent ? parent.parentPaths.concat(parent.path) : []
    const filePath = entryFilepath(config, data, parentPaths)
    const childrenDir = entryChildrenDir(config, data, parentPaths)
    const parentDir = dirname(filePath)
    const entryType = config.schema[selected]!
    const url = entryUrl(entryType, {...data, parentPaths})
    const copyFrom = form.data().copyFrom?.[EntryReference.entry]
    const entryData = copyFrom
      ? await graph.preferPublished.query({
          first: true,
          select: Entry.data,
          filter: {_id: copyFrom}
        })
      : {}
    const entry = await createEntryRow(config, {
      entryId,
      ...data,
      filePath,
      type: selected,
      path,
      title,
      url,
      index: generateKeyBetween(null, parent?.childrenIndex || null),
      parent: parent?.id ?? null,
      seeded: null,
      level: parent ? parent.level + 1 : 0,
      parentDir: parentDir,
      childrenDir: childrenDir,
      i18nId: root.i18n ? createId() : entryId,
      modifiedAt: Date.now(),
      active: true,
      main: false,
      data: {...entryData, title, path},
      searchableText: ''
    })
    return mutate([
      {
        type: MutationType.Create,
        entryId: entry.entryId,
        entry,
        file: entryFileName(config, data, parentPaths)
      }
    ]).then(() => {
      setIsCreating(false)
      navigate(nav.entry({entryId: entry.i18nId}))
      if (parent) updateEntries([parent.i18nId])
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
