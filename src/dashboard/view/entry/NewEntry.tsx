import {
  Entry,
  EntryPhase,
  Type,
  createId,
  slugify,
  track,
  type
} from 'alinea/core'
import {
  entryChildrenDir,
  entryFileName,
  entryFilepath,
  entryUrl
} from 'alinea/core/EntryFilenames'
import {MutationType} from 'alinea/core/Mutation'
import {Projection} from 'alinea/core/pages/Projection'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {dirname} from 'alinea/core/util/Paths'
import {useForm} from 'alinea/dashboard/atoms/FormAtoms'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {useLocation, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {Modal} from 'alinea/dashboard/view/Modal'
import {link} from 'alinea/input/link'
import {select} from 'alinea/input/select'
import {text} from 'alinea/input/text'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {Button, Loader, fromModule} from 'alinea/ui'
import {Link} from 'alinea/ui/Link'
import {useAtomValue, useSetAtom} from 'jotai'
import {FormEvent, Suspense, useMemo, useState} from 'react'
import {useQuery} from 'react-query'
import {changedEntriesAtom, graphAtom, useMutate} from '../../atoms/DbAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './NewEntry.module.scss'

const styles = fromModule(css)

const parentData = {
  id: Entry.entryId,
  i18nId: Entry.i18nId,
  type: Entry.type,
  path: Entry.path,
  url: Entry.url,
  level: Entry.level,
  parent: Entry.parent,
  parentPaths({parents}) {
    return parents().select(Entry.path)
  },
  childrenIndex({children}) {
    return children().select(Entry.index).orderBy(Entry.index.asc()).first()
  }
} satisfies Projection

const titleField = text('Title', {autoFocus: true})

function NewEntryForm({parentId}: NewEntryProps) {
  const config = useConfig()
  const graph = useAtomValue(graphAtom)
  const {data: requestedParent} = useQuery(
    ['parent-req', parentId],
    async () => {
      return graph.preferDraft.get(
        Entry({entryId: parentId}).select(parentData)
      )
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
      return Type.meta(type!).isContainer
    })
    .map(pair => pair[0])
  const root = useRoot()
  const parentField = useMemo(
    () =>
      link.entry('Parent', {
        condition: Entry.type
          .isIn(containerTypes)
          .and(Entry.workspace.is(workspace))
          .and(Entry.root.is(root.name)),
        initialValue: preselectedId
          ? ({
              id: 'parent',
              ref: 'entry',
              type: 'entry',
              entry: preselectedId
            } as EntryReference)
          : undefined
      }),
    []
  )
  const typeField = useMemo(() => {
    const result = select('Select type', {})

    track.options(result, async get => {
      const types: Array<string> = []
      const selectedParent = get(parentField)
      const parentId = selectedParent?.entry
      if (!parentId) {
        types.push(...(root.contains ?? []))
      } else {
        const parent = await graph.preferDraft.get(
          Entry({entryId: parentId}).select(parentData)
        )
        const parentType = parent && config.schema[parent.type]
        types.push(
          ...((parentType && Type.meta(parentType).contains) ||
            keys(config.schema))
        )
      }
      return {
        items: fromEntries(
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

    return result
  }, [])

  const [isCreating, setIsCreating] = useState(false)
  const updateEntries = useSetAtom(changedEntriesAtom)

  const formType = useMemo(
    () =>
      type({
        parent: parentField,
        title: titleField,
        type: typeField
      }),
    []
  )
  const form = useForm(formType)

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
    const parent = await graph.preferDraft.get(
      Entry({entryId: parentId}).select(parentData)
    )
    const parentPaths = parent ? parent.parentPaths.concat(parent.path) : []
    const filePath = entryFilepath(config, data, parentPaths)
    const childrenDir = entryChildrenDir(config, data, parentPaths)
    const parentDir = dirname(filePath)
    const entryType = config.schema[selected]!
    const url = entryUrl(entryType, {...data, parentPaths})
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
      seeded: false,
      level: parent ? parent.level + 1 : 0,
      parentDir: parentDir,
      childrenDir: childrenDir,
      i18nId: root.i18n ? createId() : entryId,
      modifiedAt: Date.now(),
      active: true,
      main: false,
      data: {title, path},
      searchableText: ''
    })
    return mutate({
      type: MutationType.Create,
      entryId: entry.entryId,
      entry,
      file: entryFileName(config, data, parentPaths)
    }).then(() => {
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
      <InputForm border={false} form={form} type={formType} />
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
