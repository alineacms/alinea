import {InputForm} from 'alinea/editor'
import {Button, HStack, Stack, fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Modal} from 'alinea/ui/Modal'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useRef} from 'react'
import {entryRevisionAtoms} from '../atoms/EntryAtoms.js'
import {EntryEditor} from '../atoms/EntryEditor.js'
import {useRouteBlocker} from '../atoms/RouterAtoms.js'
import {useNav} from '../hook/UseNav.js'
import css from './EntryEdit.module.scss'
import {EditMode} from './entry/EditMode.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryTitle} from './entry/EntryTitle.js'
const styles = fromModule(css)

interface EntryEditProps {
  editor: EntryEditor
}

export function EntryEdit({editor}: EntryEditProps) {
  const nav = useNav()
  const [mode, setMode] = useAtom(editor.editMode)
  const hasChanges = useAtomValue(editor.hasChanges)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({top: 0})
  }, [editor.entryId])
  const forceRefresh = useSetAtom(entryRevisionAtoms(editor.entryId))
  // Todo: prettify server conflicts
  const {isBlocking, nextRoute, confirm, cancel} = useRouteBlocker(
    'Are you sure you want to discard changes?',
    hasChanges
  )
  const isNavigationChange =
    (nextRoute?.data.editor as EntryEditor)?.entryId !== editor.entryId
  const isActivePhase = editor.activePhase === selectedPhase
  const state = isActivePhase ? editor.draftState : editor.states[selectedPhase]
  return (
    <>
      {isBlocking && (
        <Modal open onClose={() => cancel()}>
          <p>
            This document was changed, would you like to save your changes
            {isNavigationChange ? ' before navigating' : ''}?
          </p>
          <HStack as="footer">
            <Stack.Right>
              <HStack gap={16}>
                <Button outline type="button" onClick={confirm}>
                  Discard my changes
                </Button>
                <Button onClick={cancel}>Save as draft</Button>
              </HStack>
            </Stack.Right>
          </HStack>
        </Modal>
      )}
      <Main
        ref={ref}
        className={styles.root()}
        head={<EntryHeader mode={mode} setMode={setMode} editor={editor} />}
      >
        <Main.Container>
          <Button
            onClick={() => {
              forceRefresh()
            }}
          >
            Force server version update
          </Button>
          <br />
          <br />
          <EntryTitle
            editor={editor}
            backLink={
              editor.version.parent &&
              nav.entry({
                id: editor.version.parent,
                workspace: editor.version.workspace
              })
            }
          />
          Dirty: {hasChanges ? 'true' : 'false'}
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
              <InputForm
                key={editor.entryId + selectedPhase}
                type={editor.type}
                state={state}
              />
            </>
          )}
        </Main.Container>
      </Main>
      {/*preview && <EntryPreview preview={preview} draft={draft} />*/}
    </>
  )
}

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
