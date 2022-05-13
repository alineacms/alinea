import {createId, docFromEntry, Entry, Outcome, slugify} from '@alinea/core'
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
  Typo
} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {Link} from '@alinea/ui/Link'
import {Main} from '@alinea/ui/Main'
import {Modal} from '@alinea/ui/Modal'
import {FormEvent, Suspense, useLayoutEffect, useState} from 'react'
import {useQuery, useQueryClient} from 'react-query'
import {useNavigate} from 'react-router'
import * as Y from 'yjs'
import {EntryDraft} from '../draft/EntryDraft'
import {EntryProperty} from '../draft/EntryProperty'
import {useLocale} from '../hook/UseLocale'
import {useNav} from '../hook/UseNav'
import {useRoot} from '../hook/UseRoot'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
import {EntryDiff} from './diff/EntryDiff'
import {EditMode} from './entry/EditMode'
import {EntryHeader} from './entry/EntryHeader'
import {EntryPreview} from './entry/EntryPreview'
import {EntryTitle} from './entry/EntryTitle'
import css from './EntryEdit.module.scss'

const styles = fromModule(css)

type EntryEditDraftProps = {
  initialMode: EditMode
  draft: EntryDraft
  isLoading: boolean
}

function EntryEditDraft({initialMode, draft, isLoading}: EntryEditDraftProps) {
  const nav = useNav()
  const queryClient = useQueryClient()
  const locale = useLocale()
  const {schema} = useWorkspace()
  const {hub} = useSession()
  const navigate = useNavigate()
  const type = schema.type(draft.type)
  const {preview} = useWorkspace()
  const isTranslating = !isLoading && locale !== draft.i18n?.locale
  const [isCreating, setIsCreating] = useState(false)
  const [mode, setMode] = useState<EditMode>(initialMode)
  const {data: original} = useQuery(
    ['original', draft.id],
    () => {
      return hub
        .query(Entry.where(Entry.id.is(draft.id)), {source: true})
        .then(Outcome.unpack)
        .then(res => res[0])
    },
    {suspense: true}
  )
  function handleTranslation() {
    if (!locale || isCreating) return
    setIsCreating(true)
    const entry = draft.getEntry()
    entry.id = createId()
    entry.i18n!.locale = locale
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
  useLayoutEffect(() => {
    const mightHaveTranslation = locale && isTranslating
    if (!mightHaveTranslation) return
    const translation = draft.translation(locale)
    if (translation) navigate(nav.entry(translation))
  }, [draft, isTranslating, locale])
  return (
    <>
      <Main className={styles.root()}>
        <EntryHeader mode={mode} setMode={setMode} />
        <div className={styles.root.draft()}>
          <EntryTitle
            backLink={
              draft.parent &&
              nav.entry({
                id: draft.parent,
                workspace: draft.workspace
              })
            }
          />
          {mode === EditMode.Diff ? (
            <>
              {original && (
                <EntryDiff entryA={original} entryB={draft.getEntry()} />
              )}
            </>
          ) : (
            <>
              {' '}
              {isTranslating ? (
                <Button onClick={() => handleTranslation()}>
                  Translate from {draft.i18n?.locale.toUpperCase()}
                </Button>
              ) : (
                <Suspense fallback={null}>
                  {type ? (
                    <InputForm type={type} state={EntryProperty.root} />
                  ) : (
                    <ErrorMessage error={new Error('Type not found')} />
                  )}
                </Suspense>
              )}
            </>
          )}
        </div>
      </Main>
      {preview && <EntryPreview preview={preview} draft={draft} />}
    </>
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
    const entry = {
      ...type.create(selectedType),
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
    <Modal open onClose={handleClose} className={styles.new()}>
      <HStack center gap={18} className={styles.new.header()}>
        <IconButton icon={IcRoundArrowBack} onClick={handleClose} />
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
            <div className={styles.new.footer()}>
              <Link
                href={nav.entry({workspace, ...parent})}
                className={styles.new.footer.link()}
              >
                Cancel
              </Link>
              <Button>Create</Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

export type EntryEditProps = {
  initialMode: EditMode
  draft: EntryDraft
  isLoading: boolean
}

export function EntryEdit({initialMode, draft, isLoading}: EntryEditProps) {
  return (
    <EntryEditDraft
      initialMode={initialMode}
      draft={draft}
      isLoading={isLoading}
    />
  )
}
