import {createId, docFromEntry, Entry, slugify} from '@alinea/core'
import {useField} from '@alinea/editor'
import {InputField} from '@alinea/editor/view/InputField'
import {link} from '@alinea/input.link'
import {select} from '@alinea/input.select'
import {text} from '@alinea/input.text'
import {EntryReference} from '@alinea/picker.entry'
import {
  Button,
  fromModule,
  HStack,
  IconButton,
  Loader,
  Typo,
  useObservable
} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {Link} from '@alinea/ui/Link'
import {Modal} from '@alinea/ui/Modal'
import {FormEvent, useState} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import {useNavigate} from 'react-router'
import * as Y from 'yjs'
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
  const {hub} = useSession()
  const {name: workspace, schema} = useWorkspace()
  const containerTypes = [...schema.entries()]
    .filter(pair => {
      return pair[1].isContainer
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
  const {data: parentEntry} = useQuery(
    ['parent', selectedParent],
    () => {
      const parentId = (selectedParent?.[0] as EntryReference)?.entry
      return parentId ? hub.entry({id: parentId}) : undefined
    },
    {suspense: true, keepPreviousData: true}
  )
  const parent = parentEntry?.isSuccess() ? parentEntry.value?.entry : undefined
  const type = parent && schema.type(parent.type)
  const types: Array<string> = !parent
    ? root.contains
    : type?.options.contains || schema.keys
  const selectedType = useField(
    select(
      'Select type',
      Object.fromEntries(
        types.map(typeKey => {
          const type = schema.type(typeKey)
          return [typeKey, (type?.label || typeKey) as string]
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
    const type = schema.type(selected)!
    const path = slugify(title)
    const entry = {
      ...type.create(),
      path,
      workspace,
      root: root.name,
      parent: parent?.id,
      url: (parent?.url || '') + (parent?.url.endsWith('/') ? '' : '/') + path,
      title
    }
    if (root.i18n) {
      entry.i18n = {
        id: createId(),
        locale
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
            entry.workspace,
            entry.root,
            entry.parent
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
