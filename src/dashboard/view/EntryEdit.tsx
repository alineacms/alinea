import {EntryPhase} from 'alinea/core'
import {values} from 'alinea/core/util/Objects'
import {useLocation} from 'alinea/dashboard/util/HashRouter'
import {InputForm} from 'alinea/editor'
import {fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {useAtom, useAtomValue} from 'jotai'
import {Suspense} from 'react'
import {useEntryEditor} from '../atoms/EntryAtoms.js'
import {useNav} from '../hook/UseNav.js'
import css from './EntryEdit.module.scss'
import {EditMode} from './entry/EditMode.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryTitle} from './entry/EntryTitle.js'

const styles = fromModule(css)

interface EntryEditProps {
  id: string
}

export function EntryEdit({id}: EntryEditProps) {
  const {search} = useLocation()
  const nav = useNav()
  const entryEditor = useEntryEditor(id)
  const [mode, setMode] = useAtom(entryEditor.editMode)
  const phases = useAtomValue(entryEditor.phases)
  const phaseInSearch = search.slice(1) as EntryPhase
  const selectedPhase: EntryPhase = values(EntryPhase).includes(phaseInSearch)
    ? phaseInSearch
    : phases[0]
  const versionEditor = useAtomValue(entryEditor.versionEditor(selectedPhase))
  const version = useAtomValue(versionEditor.version)
  const type = useAtomValue(versionEditor.type)
  const state = useAtomValue(versionEditor.state)
  /*  const {schema} = useConfig()
  const type = schema[draft.type]
  const {preview} = useWorkspace()
  const isTranslating = !isLoading && locale !== draft.alinea.i18n?.locale
  const [isCreating, setIsCreating] = useState(false)
  const [mode, setMode] = useState<EditMode>(initialMode)
  const status = useObservable(draft.phase)
  function handleTranslation() {
    if (!locale || isCreating) return
    setIsCreating(true)
    const entry = draft.getEntry()
    entry.versionId = createId()
    entry.alinea.i18n!.locale = locale
    const path = entry.url.split('/').slice(1).join('/')
    entry.url = `/${locale}/${path}`
    const doc = docFromEntry(entry, () => type)
    return hub
      .updateDraft({id: entry.versionId, update: Y.encodeStateAsUpdate(doc)})
      .then(result => {
        if (!result.isFailure()) {
          queryClient.invalidateQueries(['draft', draft.versionId])
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
  }, [draft, isTranslating, locale])*/
  return (
    <>
      <Main
        className={styles.root()}
        head={
          <EntryHeader
            mode={mode}
            setMode={setMode}
            versionEditor={versionEditor}
          />
        }
      >
        <Main.Container>
          <EntryTitle
            versionEditor={versionEditor}
            backLink={
              version.parent &&
              nav.entry({id: version.parent, workspace: version.workspace})
            }
          />
          {mode === EditMode.Diff ? (
            <>
              Show entry diff here
              {/*draft.detail.original && (
                <EntryDiff
                  entryA={draft.detail.original}
                  entryB={draft.getEntry()}
                />
              )*/}
            </>
          ) : (
            <>
              {/*isTranslating ? (
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
                  )*/}
              <Suspense fallback={null}>
                <InputForm type={type} state={state} />
              </Suspense>
            </>
          )}
        </Main.Container>
      </Main>
      {/*preview && <EntryPreview preview={preview} draft={draft} />*/}
    </>
  )
}
