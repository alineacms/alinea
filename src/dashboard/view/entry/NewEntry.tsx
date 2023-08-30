import {Entry, EntryPhase, EntryRow, Type, createId, slugify} from 'alinea/core'
import {
  entryChildrenDir,
  entryFileName,
  entryFilepath
} from 'alinea/core/EntryFilenames'
import {MutationType} from 'alinea/core/Mutation'
import {Projection} from 'alinea/core/pages/Projection'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {dirname} from 'alinea/core/util/Paths'
import {useLocation, useNavigate} from 'alinea/dashboard/util/HashRouter'
import {Modal} from 'alinea/dashboard/view/Modal'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {link} from 'alinea/input/link'
import {select} from 'alinea/input/select'
import {text} from 'alinea/input/text'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {Button, Loader, fromModule} from 'alinea/ui'
import {Link} from 'alinea/ui/Link'
import {useObservable} from 'alinea/ui/util/Observable'
import {useAtomValue} from 'jotai'
import {FormEvent, Suspense, useState} from 'react'
import {useQuery} from 'react-query'
import {graphAtom, useMutate} from '../../atoms/DbAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './NewEntry.module.scss'

const styles = fromModule(css)

const parentData = {
  id: Entry.entryId,
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
  const parentField = useField(
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
    })
  )
  const selectedParent = useObservable(parentField)
  const {data: parent} = useQuery(
    ['parent', selectedParent],
    async () => {
      const parentId = selectedParent?.entry
      if (!parentId) return
      return graph.preferDraft.get(
        Entry({entryId: parentId}).select(parentData)
      )
    },
    {suspense: true, keepPreviousData: true, staleTime: 0}
  )
  const parentPaths = parent ? parent.parentPaths.concat(parent.path) : []
  const type = parent && config.schema[parent.type]
  const types: Array<string> = !parent
    ? root.contains || []
    : (type && Type.meta(type).contains) || keys(config.schema)
  const selectedType = useField(
    select(
      'Select type',
      fromEntries(
        types.map(typeKey => {
          const type = config.schema[typeKey]!
          return [typeKey, (Type.label(type) || typeKey) as string]
        })
      ),
      {initialValue: types[0]}
    ),
    [type]
  )
  const titleField = useField(text('Title', {autoFocus: true}))
  const [isCreating, setIsCreating] = useState(false)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    const title = titleField()
    const selected = selectedType()
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
    const filePath = entryFilepath(config, data, parentPaths)
    const childrenDir = entryChildrenDir(config, data, parentPaths)
    const parentDir = dirname(filePath)
    const url =
      (parent?.url || '') + (parent?.url.endsWith('/') ? '' : '/') + path
    const entry: EntryRow = {
      entryId,
      ...data,
      filePath,
      type: selected,
      path,
      title,
      url: root.i18n ? `/${locale}${url}` : url,
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
      contentHash: '', // Todo: set content hash here
      data: {title, path},
      searchableText: ''
    }
    const result = mutate({
      type: MutationType.Create,
      entryId: entry.entryId,
      entry,
      file: entryFileName(config, data, parentPaths)
    })
    navigate(nav.entry({entryId: entry.i18nId}))
    return result
  }
  return (
    <form onSubmit={handleCreate}>
      {isCreating ? (
        <Loader absolute />
      ) : (
        <>
          {/*parent && <ParentView {...parent} />*/}
          <InputField {...parentField} />
          <InputField {...titleField} />
          <InputField {...selectedType} />
          <div className={styles.root.footer()}>
            <Link href={pathname} className={styles.root.footer.link()}>
              Cancel
            </Link>
            <Button>Create</Button>
          </div>
        </>
      )}
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
