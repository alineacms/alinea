import {createId, docFromEntry, Entry, slugify} from '@alinea/core'
import {InputForm, InputState} from '@alinea/editor'
import {select} from '@alinea/input.select'
import {SelectInput} from '@alinea/input.select/view'
import {text} from '@alinea/input.text'
import {TextInput} from '@alinea/input.text/view'
import {
  Button,
  ErrorMessage,
  fromModule,
  HStack,
  IconButton,
  Loader,
  TextLabel,
  Typo,
  useObservable
} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import {ComponentType, FormEvent, Suspense, useState} from 'react'
import {MdArrowBack} from 'react-icons/md'
import {useQuery, useQueryClient} from 'react-query'
import {useNavigate} from 'react-router'
import {Link} from 'react-router-dom'
import * as Y from 'yjs'
import {EntryDraft} from '../draft/EntryDraft'
import {EntryProperty} from '../draft/EntryProperty'
import {useLocale} from '../hook/UseLocale'
import {useNav} from '../hook/UseNav'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {EntryHeader} from './entry/EntryHeader'
import {EntryTitle} from './entry/EntryTitle'
import css from './EntryEdit.module.scss'

const styles = fromModule(css)

type EntryPreviewProps = {
  draft: EntryDraft
  preview: ComponentType<{entry: Entry; previewToken: string}>
}

function EntryPreview({draft, preview: Preview}: EntryPreviewProps) {
  const entry = useObservable(draft.entry)
  return <Preview entry={entry} previewToken={draft.detail.previewToken} />
}

type EntryEditDraftProps = {draft: EntryDraft; isLoading: boolean}

function EntryEditDraft({draft, isLoading}: EntryEditDraftProps) {
  const nav = useNav()
  const queryClient = useQueryClient()
  const locale = useLocale()
  const {schema} = useWorkspace()
  const {hub} = useSession()
  const navigate = useNavigate()
  const type = schema.type(draft.type)
  const {preview} = useWorkspace()
  const isTranslating = !isLoading && locale !== draft.locale
  const [isCreating, setIsCreating] = useState(false)
  function handleTranslation() {
    if (isCreating) return
    setIsCreating(true)
    const entry = draft.getEntry()
    entry.id = createId()
    entry.locale = locale
    const path = entry.url.split('/').slice(1).join('/')
    entry.url = `/${locale}/${path}`
    const doc = docFromEntry(entry, () => type)
    return hub
      .updateDraft(entry.id, Y.encodeStateAsUpdate(doc))
      .then(result => {
        if (!result.isFailure()) {
          queryClient.invalidateQueries(['draft', draft.id])
          navigate(nav.entry(entry))
        } else {
          throw result.error
        }
      })
      .finally(() => setIsCreating(false))
  }
  return (
    <HStack style={{height: '100%'}}>
      <div className={styles.root()}>
        <EntryHeader />
        <div className={styles.root.draft()}>
          <EntryTitle backLink={draft.parent && nav.entry(draft)} />
          {isTranslating ? (
            <Button onClick={() => handleTranslation()}>
              Translate from {draft.locale?.toUpperCase()}
            </Button>
          ) : (
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
                <ErrorMessage error={new Error('Type not found')} />
              )}
            </Suspense>
          )}
        </div>
      </div>
      {preview && <EntryPreview preview={preview} draft={draft} />}
    </HStack>
  )
}

export type NewEntryProps = {parentId?: string}

export function NewEntry({parentId}: NewEntryProps) {
  const nav = useNav()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const {hub} = useSession()
  const {name: workspace, schema} = useWorkspace()
  const root = useRoot()
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
  const types: Array<string> = !parentId
    ? root.contains
    : type?.options.contains || schema.keys
  const [selectedType, setSelectedType] = useState<string | undefined>(types[0])
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!selectedType || !title) return
    setIsCreating(true)
    const type = schema.type(selectedType)!
    const path = slugify(title)
    const entry: Entry = {
      ...type.create(selectedType),
      path,
      workspace,
      root: root.name,
      parent: parent?.id,
      url: (parent?.url || '') + (parent?.url.endsWith('/') ? '' : '/') + path,
      title
    }
    if (root.i18n) {
      entry.locale = locale
      entry.i18nId = createId()
      entry.url = `/${locale}/${entry.url}`
    }
    const doc = docFromEntry(entry, () => type)
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
          navigate(nav.entry(entry))
        }
      })
      .finally(() => {
        setIsCreating(false)
      })
  }

  function handleClose() {
    navigate(nav.entry({workspace, ...parent}))
  }

  /*const parentType = parent && schema.type(parent.type)
  const ParentView: any =
    parent && (parentType?.options.summaryRow || EntrySummaryRow)*/

  return (
    <Modal open onClose={handleClose}>
      <HStack center gap={18} className={styles.new.header()}>
        <IconButton icon={MdArrowBack} onClick={handleClose} />
        <Typo.H1 flat>
          New entry{' '}
          {parent && (
            <>
              in <TextLabel label={parent.title} />
            </>
          )}
        </Typo.H1>
      </HStack>
      <form onSubmit={handleCreate}>
        {isCreating ? (
          <Loader absolute />
        ) : (
          <>
            {/*parent && <ParentView {...parent} />*/}
            <TextInput
              state={new InputState.StatePair(title, setTitle)}
              field={text('Title', {autoFocus: true})}
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
            <Link to={nav.entry({workspace, ...parent})}>Cancel</Link>
            <Button>Create</Button>
          </>
        )}
      </form>
    </Modal>
  )
}

export type EntryEditProps = {draft: EntryDraft; isLoading: boolean}

export function EntryEdit({draft, isLoading}: EntryEditProps) {
  return <EntryEditDraft draft={draft} isLoading={isLoading} />
}
