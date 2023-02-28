import {createId, docFromEntry, EntryStatus} from 'alinea/core'
import {InputForm} from 'alinea/editor'
import {Button, ErrorMessage, fromModule, useObservable} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useNavigate} from 'alinea/ui/util/HashRouter'
import {Suspense, useLayoutEffect, useState} from 'react'
import {useQueryClient} from 'react-query'
import * as Y from 'yjs'
import {EntryDraft} from '../draft/EntryDraft.js'
import {EntryProperty} from '../draft/EntryProperty.js'
import {useDashboard} from '../hook/UseDashboard.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {useSession} from '../hook/UseSession.js'
import {useWorkspace} from '../hook/UseWorkspace.js'
import {EntryDiff} from './diff/EntryDiff.js'
import {EditMode} from './entry/EditMode.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryPreview} from './entry/EntryPreview.js'
import {EntryTitle} from './entry/EntryTitle.js'
import css from './EntryEdit.module.scss'

const styles = fromModule(css)

export type EntryEditProps = {
  initialMode: EditMode
  draft: EntryDraft
  isLoading: boolean
}

export function EntryEdit({initialMode, draft, isLoading}: EntryEditProps) {
  const nav = useNav()
  const queryClient = useQueryClient()
  const locale = useLocale()
  const {schema} = useDashboard().config
  const {hub} = useSession()
  const navigate = useNavigate()
  const type = schema.type(draft.type)
  const {preview} = useWorkspace()
  const isTranslating = !isLoading && locale !== draft.alinea.i18n?.locale
  const [isCreating, setIsCreating] = useState(false)
  const [mode, setMode] = useState<EditMode>(initialMode)
  const status = useObservable(draft.status)
  function handleTranslation() {
    if (!locale || isCreating) return
    setIsCreating(true)
    const entry = draft.getEntry()
    entry.id = createId()
    entry.alinea.i18n!.locale = locale
    const path = entry.url.split('/').slice(1).join('/')
    entry.url = `/${locale}/${path}`
    const doc = docFromEntry(entry, () => type)
    return hub
      .updateDraft({id: entry.id, update: Y.encodeStateAsUpdate(doc)})
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
      <Main
        className={styles.root()}
        head={<EntryHeader mode={mode} setMode={setMode} />}
      >
        <Main.Container>
          <EntryTitle
            backLink={
              draft.alinea.parent &&
              nav.entry({
                id: draft.alinea.parent,
                workspace: draft.alinea.workspace
              })
            }
          />
          {mode === EditMode.Diff && status !== EntryStatus.Published ? (
            <>
              {draft.detail.original && (
                <EntryDiff
                  entryA={draft.detail.original}
                  entryB={draft.getEntry()}
                />
              )}
            </>
          ) : (
            <>
              {isTranslating ? (
                <Button onClick={() => handleTranslation()}>
                  Translate from {draft.alinea.i18n?.locale.toUpperCase()}
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
        </Main.Container>
      </Main>
      {preview && <EntryPreview preview={preview} draft={draft} />}
    </>
  )
}
