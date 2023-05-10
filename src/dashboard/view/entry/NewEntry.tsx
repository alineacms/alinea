import {
  createId,
  docFromEntry,
  Entry,
  Outcome,
  slugify,
  Type
} from 'alinea/core'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import {entries, fromEntries, keys} from 'alinea/core/util/Objects'
import {useNavigate} from 'alinea/dashboard/util/HashRouter'
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
  IconButton,
  Loader,
  Typo,
  useObservable
} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {Link} from 'alinea/ui/Link'
import {Modal} from 'alinea/ui/Modal'
import {FormEvent, useState} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import * as Y from 'yjs'
import {useDashboard} from '../../hook/UseDashboard'
import {useLocale} from '../../hook/UseLocale'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useSession} from '../../hook/UseSession'
import {useWorkspace} from '../../hook/UseWorkspace'
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
      condition: Entry.type
        .isIn(containerTypes)
        .and(Entry.workspace.is(workspace))
        .and(Entry.root.is(root.name)),
      initialValue: parentId
        ? [{id: 'parent', type: 'entry', entry: parentId}]
        : undefined
    })
  )
  const selectedParent = useObservable(parentField)
  const {data: parent} = useQuery(
    ['parent', selectedParent],
    () => {
      const parentId = (selectedParent?.[0] as EntryReference)?.entry
      if (!parentId) return
      const Child = Entry.as('Child')
      return hub
        .query({
          cursor: Entry.where(Entry.id.is(parentId)).select({
            id: Entry.id,
            type: Entry.type,
            url: Entry.url,
            alinea: Entry.alinea,
            childrenIndex: Child.where(Child.alinea.parent.is(Entry.id))
              .select(Child.alinea.index)
              .orderBy(Child.alinea.index.asc())
              .first()
          })
        })
        .then(Outcome.unpack)
        .then(res => res[0])
    },
    {suspense: true, keepPreviousData: true}
  )
  const type = parent && schema[parent.type]
  const types: Array<string> = !parent
    ? root.contains
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
    const entry: Entry = {
      ...Type.blankEntry(selected, type),
      path,
      title,
      url: (parent?.url || '') + (parent?.url.endsWith('/') ? '' : '/') + path,
      alinea: {
        index: generateKeyBetween(null, parent?.childrenIndex || null),
        workspace,
        root: root.name,
        parent: parent?.id,
        parents: []
      }
    }
    if (root.i18n) {
      entry.alinea.i18n = {
        id: createId(),
        locale: locale!,
        parent: parent?.id,
        parents: ([] as Array<string | undefined>)
          .concat(parent?.alinea.i18n?.parents)
          .concat(parent?.id)
          .filter(Boolean) as Array<string>
      }
      entry.url = `/${locale}${entry.url}`
    }
    const doc = docFromEntry(entry, () => type)
    return hub
      .updateDraft({id: entry.id, update: Y.encodeStateAsUpdate(doc)})
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
      })
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
    navigate(nav.entry({workspace, id: parentId}))
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
