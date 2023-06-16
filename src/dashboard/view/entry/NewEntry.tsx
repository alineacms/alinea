import {createId, Entry, EntryPhase, Page, slugify, Type} from 'alinea/core'
import {Projection} from 'alinea/core/pages/Projection'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {useDashboard} from 'alinea/dashboard'
import {useNavigate} from 'alinea/dashboard/util/HashRouter'
import {Modal} from 'alinea/dashboard/view/Modal'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {link} from 'alinea/input/link'
import {select} from 'alinea/input/select'
import {text} from 'alinea/input/text'
import {EntryReference} from 'alinea/picker/entry'
import {Button, fromModule, HStack, Loader, Typo} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {Link} from 'alinea/ui/Link'
import {useObservable} from 'alinea/ui/util/Observable'
import {useAtomValue, useSetAtom} from 'jotai'
import {FormEvent, useState} from 'react'
import {useQuery} from 'react-query'
import {changedEntriesAtom, graphAtom} from '../../atoms/EntryAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useLocale} from '../../hook/UseLocale'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useWorkspace} from '../../hook/UseWorkspace'
import {IconButton} from '../IconButton.js'
import css from './NewEntry.module.scss'

const styles = fromModule(css)

const parentData = {
  id: Page.entryId,
  type: Page.type,
  url: Page.url,
  level: Page.level,
  parent: Page.parent,
  childrenIndex({children}) {
    return children().select(Page.index).orderBy(Page.index.asc()).first()
  }
} satisfies Projection

function NewEntryForm({parentId}: NewEntryProps) {
  const {client} = useDashboard()
  const {schema} = useConfig()
  const graph = useAtomValue(graphAtom)
  const {data: requestedParent} = useQuery(
    ['parent-req', parentId],
    async () => {
      return graph.active.get(Page({entryId: parentId}).select(parentData))
    },
    {suspense: true, keepPreviousData: true}
  )
  const preselectedId =
    requestedParent &&
    (Type.isContainer(schema[requestedParent.type])
      ? requestedParent.id
      : requestedParent.parent)
  const nav = useNav()
  const navigate = useNavigate()
  const locale = useLocale()
  const {name: workspace} = useWorkspace()
  const containerTypes = entries(schema)
    .filter(([, type]) => {
      return Type.meta(type!).isContainer
    })
    .map(pair => pair[0])
  const root = useRoot()
  const parentField = useField(
    link.entry('Parent', {
      condition: Page.type
        .isIn(containerTypes)
        .and(Page.workspace.is(workspace))
        .and(Page.root.is(root.name)),
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
      return graph.active.get(Page({entryId: parentId}).select(parentData))
    },
    {suspense: true, keepPreviousData: true}
  )
  const type = parent && schema[parent.type]
  const types: Array<string> = !parent
    ? root.contains || []
    : (type && Type.meta(type).contains) || keys(schema)
  const selectedType = useField(
    select(
      'Select type',
      fromEntries(
        types.map(typeKey => {
          const type = schema[typeKey]!
          return [typeKey, (Type.label(type) || typeKey) as string]
        })
      ),
      {initialValue: types[0]}
    ),
    [type]
  )
  const titleField = useField(text('Title', {autoFocus: true}))
  const [isCreating, setIsCreating] = useState(false)
  const updateEntries = useSetAtom(changedEntriesAtom)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    const title = titleField()
    const selected = selectedType()
    if (!selected || !title) return
    setIsCreating(true)
    const type = schema[selected]!
    const path = slugify(title)
    const entry: Partial<Entry> = {
      entryId: createId(),
      type: selected,
      path,
      title,
      url: (parent?.url || '') + (parent?.url.endsWith('/') ? '' : '/') + path,
      index: generateKeyBetween(null, parent?.childrenIndex || null),
      workspace,
      root: root.name,
      parent: parent?.id ?? null,
      phase: EntryPhase.Draft,
      seeded: false,
      level: parent ? parent.level + 1 : 0,
      data: {}
    }
    if (root.i18n) {
      entry.locale = locale
      entry.i18nId = createId()
      entry.url = `/${locale}${entry.url}`
    }

    return client
      .saveDraft(entry as Entry)
      .then(() => {
        updateEntries([])
        navigate(nav.entry(entry))
      })
      .finally(() => {
        setIsCreating(false)
      })

    /*const doc = docFromEntry(entry, () => type)
    return hub
      .updateDraft({id: entry.versionId, update: Y.encodeStateAsUpdate(doc)})
      .then(result => {
        if (result.isSuccess()) {
          queryClient.invalidateQueries([
            'children',
            entry.alinea.workspace,
            entry.alinea.root,
            entry.alinea.parent
          ])
          navigate(nav.entry(entry))
        }
      })
      .finally(() => {
        setIsCreating(false)
      })*/
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
            <Link
              href={nav.entry({workspace, ...parent})}
              className={styles.root.footer.link()}
            >
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
  const nav = useNav()
  const navigate = useNavigate()
  const {name: workspace} = useWorkspace()

  function handleClose() {
    navigate(nav.entry({workspace, entryId: parentId}))
  }

  return (
    <Modal open onClose={handleClose} className={styles.root()}>
      <HStack center gap={18} className={styles.root.header()}>
        <IconButton icon={IcRoundArrowBack} onClick={handleClose} />
        <Typo.H1 flat>New entry</Typo.H1>
      </HStack>
      <NewEntryForm parentId={parentId} />
    </Modal>
  )
}
