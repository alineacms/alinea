import {docFromEntry, Entry, slugify} from '@alinea/core'
import {InputForm, InputState} from '@alinea/editor'
import {select} from '@alinea/input.select'
import {SelectInput} from '@alinea/input.select/view'
import {text} from '@alinea/input.text'
import {TextInput} from '@alinea/input.text/view'
import {
  fromModule,
  HStack,
  IconButton,
  Loader,
  Typo,
  useObservable
} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import {ComponentType, FormEvent, Suspense, useState} from 'react'
import {MdArrowBack} from 'react-icons/md'
import {useQuery, useQueryClient} from 'react-query'
import {useHistory} from 'react-router'
import {Link} from 'react-router-dom'
import * as Y from 'yjs'
import {EntryDraft} from '../draft/EntryDraft'
import {EntryProperty} from '../draft/EntryProperty'
import {useDashboard} from '../hook/UseDashboard'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {EntryHeader} from './entry/EntryHeader'
import {EntryTitle} from './entry/EntryTitle'
import css from './EntryEdit.module.scss'

const styles = fromModule(css)

type EntryPreviewProps = {
  draft: EntryDraft
  preview: ComponentType<Entry>
}

function EntryPreview({draft, preview: Preview}: EntryPreviewProps) {
  const entry = useObservable(draft.entry)
  return <Preview {...entry} />
}

type EntryEditDraftProps = {draft: EntryDraft}

function EntryEditDraft({draft}: EntryEditDraftProps) {
  const {nav} = useDashboard()
  const {schema} = useWorkspace()
  const type = schema.type(draft.type)
  const {preview} = useWorkspace()
  return (
    <HStack style={{height: '100%'}}>
      <div className={styles.root()}>
        <EntryHeader />
        <div className={styles.root.draft()}>
          <EntryTitle
            backLink={
              draft.parent &&
              nav.entry(draft.workspace, draft.root, draft.parent)
            }
          />
          <div className={styles.root.draft.fields()}>
            <Suspense fallback={null}>
              {type ? (
                <InputForm
                  // We key here currently because the tiptap/yjs combination fails to register
                  // changes when the fragment is changed while the editor is mounted.
                  key={draft.doc.guid}
                  type={type}
                  state={EntryProperty.root}
                />
              ) : (
                'Channel not found'
              )}
            </Suspense>
          </div>
        </div>
      </div>
      {preview && <EntryPreview preview={preview} draft={draft} />}
    </HStack>
  )
}

export type NewEntryProps = {parentId?: string}

export function NewEntry({parentId}: NewEntryProps) {
  const {nav} = useDashboard()
  const queryClient = useQueryClient()
  const history = useHistory()
  const {hub} = useSession()
  const {workspace, schema} = useWorkspace()
  const {root} = useRoot()
  const {data: parentEntry} = useQuery(
    ['parent', parentId],
    () => {
      return parentId ? hub.entry(parentId) : undefined
    },
    {
      suspense: true,
      refetchOnWindowFocus: false
    }
  )
  const parent = parentEntry?.isSuccess() ? parentEntry.value?.entry : undefined
  const type = parent && schema.type(parent.type)
  const types = type?.options.contains || schema.keys
  const [selectedType, setSelectedType] = useState(types[0])
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!selectedType) return
    setIsCreating(true)
    const type = schema.type(selectedType)!
    const path = slugify(title)
    const entry: Entry = {
      ...type.create(selectedType),
      path,
      workspace,
      root,
      parent: parent?.id,
      url: (parent?.url || '') + (parent?.url.endsWith('/') ? '' : '/') + path,
      title
    }
    const doc = docFromEntry(type, entry)
    return hub
      .updateDraft(entry.id, Y.encodeStateAsUpdate(doc))
      .then(result => {
        if (result.isSuccess()) {
          queryClient.invalidateQueries([
            'children',
            entry.workspace,
            entry.root,
            entry.parent
          ])
          history.push(nav.entry(entry.workspace, entry.root, entry.id))
        }
      })
      .finally(() => {
        setIsCreating(false)
      })
  }

  function handleClose() {
    history.push(nav.entry(workspace, parent?.root, parent?.id))
  }

  if (!parentId) return null
  return (
    <Modal open onClose={handleClose}>
      <HStack center gap={18} className={styles.new.header()}>
        <IconButton icon={MdArrowBack} onClick={handleClose} />
        <Typo.H1 flat>New entry</Typo.H1>
      </HStack>
      <form onSubmit={handleCreate}>
        {isCreating ? (
          <Loader absolute />
        ) : (
          <>
            <TextInput
              state={new InputState.StatePair(title, setTitle)}
              field={text('Title')}
            />
            <SelectInput
              state={new InputState.StatePair(selectedType, setSelectedType)}
              field={select(
                'Select type',
                Object.fromEntries(
                  types.map(typeKey => {
                    const type = schema.type(typeKey)
                    return [typeKey, type?.label || typeKey]
                  })
                )
              )}
            />
            <Link to={nav.entry(workspace, parent?.root, parent?.id)}>
              Cancel
            </Link>
            <button>Create</button>
          </>
        )}
      </form>
    </Modal>
  )
}

export type EntryEditProps = {draft: EntryDraft}

export function EntryEdit({draft}: EntryEditProps) {
  return <EntryEditDraft draft={draft} />
}
