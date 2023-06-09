import {createId, Entry, EntryPhase, Page, slugify, Type} from 'alinea/core'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {useNavigate} from 'alinea/dashboard/util/HashRouter'
import {Modal} from 'alinea/dashboard/view/Modal'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {link} from 'alinea/input/link'
import {select} from 'alinea/input/select'
import {text} from 'alinea/input/text'
import {EntryReference} from 'alinea/picker/entry'
import {
  Button,
  fromModule,
  HStack,
  Loader,
  Typo,
  useObservable
} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {Link} from 'alinea/ui/Link'
import {useAtomValue} from 'jotai'
import {FormEvent, useState} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import {graphAtom} from '../../atoms/EntryAtoms.js'
import {useDashboard} from '../../hook/UseDashboard'
import {useLocale} from '../../hook/UseLocale'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useSession} from '../../hook/UseSession'
import {useWorkspace} from '../../hook/UseWorkspace'
import {IconButton} from '../IconButton.js'
import css from './NewEntry.module.scss'

const styles = fromModule(css)

function NewEntryForm({parentId}: NewEntryProps) {
  const nav = useNav()
  const navigate = useNavigate()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const {cnx: hub} = useSession()
  const {schema} = useDashboard().config
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
      initialValue: parentId
        ? ({
            id: 'parent',
            ref: 'entry',
            type: 'entry',
            entry: parentId
          } as EntryReference)
        : undefined
    })
  )
  const selectedParent = useObservable(parentField)
  const graph = useAtomValue(graphAtom)
  const {data: parent} = useQuery(
    ['parent', selectedParent],
    async () => {
      const parentId = selectedParent?.entry
      if (!parentId) return
      const res = await graph.active.get(
        Page({entryId: parentId}).select({
          id: Page.entryId,
          type: Page.type,
          url: Page.url,
          level: Page.level,
          childrenIndex({children}) {
            return children()
              .select(Page.index)
              .orderBy(Page.index.asc())
              .first()
          }
        })
      )
      return res
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
