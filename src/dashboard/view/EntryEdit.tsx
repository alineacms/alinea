import {EntryPhase} from 'alinea/core'
import {Modal} from 'alinea/dashboard/view/Modal'
import {InputForm} from 'alinea/editor'
import {Button, HStack, Stack, VStack, fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useRef} from 'react'
import {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {useRouteBlocker} from '../atoms/RouterAtoms.js'
import {useConfig} from '../hook/UseConfig.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {SuspenseBoundary} from '../util/SuspenseBoundary.js'
import css from './EntryEdit.module.scss'
import {EntryDiff} from './diff/EntryDiff.js'
import {EditMode} from './entry/EditModeToggle.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryNotice} from './entry/EntryNotice.js'
import {EntryPreview} from './entry/EntryPreview.js'
import {EntryTitle} from './entry/EntryTitle.js'
import {FieldToolbar} from './entry/FieldToolbar.js'
const styles = fromModule(css)

function ShowChanges({editor}: EntryEditProps) {
  const draftEntry = useAtomValue(editor.draftEntry)
  const hasChanges = useAtomValue(editor.hasChanges)
  const compareTo = hasChanges
    ? editor.activeVersion
    : editor.phases[
        editor.availablePhases.find(phase => phase !== EntryPhase.Draft)!
      ]
  return <EntryDiff entryA={compareTo} entryB={draftEntry} />
}

export interface EntryEditProps {
  editor: EntryEditor
}

export function EntryEdit({editor}: EntryEditProps) {
  const locale = useLocale()
  const {preview} = useConfig()
  const nav = useNav()
  const [mode, setMode] = useAtom(editor.editMode)
  const hasChanges = useAtomValue(editor.hasChanges)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const ref = useRef<HTMLDivElement>(null)
  const isSaving = useAtomValue(editor.isSaving)
  const isPublishing = useAtomValue(editor.isPublishing)
  useEffect(() => {
    ref.current?.scrollTo({top: 0})
  }, [editor.entryId, mode, selectedPhase])
  // Todo: prettify server conflicts
  const {isBlocking, nextRoute, confirm, cancel} = useRouteBlocker(
    'Are you sure you want to discard changes?',
    false // hasChanges && !isSaving && !isPublishing
  )
  const isNavigationChange =
    (nextRoute?.data.editor as EntryEditor)?.entryId !== editor.entryId
  const isActivePhase = editor.activePhase === selectedPhase
  const state = isActivePhase ? editor.draftState : editor.states[selectedPhase]
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  const discardEdits = useSetAtom(editor.discardEdits)
  const untranslated = locale && locale !== editor.activeVersion.locale
  useEffect(() => {
    function listener(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (hasChanges) saveDraft()
        else if (selectedPhase === EntryPhase.Draft) publishDraft()
      }
    }
    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [editor, hasChanges, saveDraft])
  return (
    <>
      {isBlocking && (
        <Modal open onClose={() => cancel()}>
          <VStack gap={30}>
            <p>
              This document was changed, would you like to save your changes
              {isNavigationChange ? ' before navigating' : ''}?
            </p>
            <HStack as="footer">
              <Stack.Right>
                <HStack gap={16}>
                  <Button
                    outline
                    type="button"
                    onClick={() => {
                      discardEdits()
                      confirm()
                    }}
                  >
                    Discard my changes
                  </Button>
                  <Button
                    onClick={() => {
                      saveDraft() /*.catch(() => {
                        console.warn(
                          'Failed to save draft, this should redirect back to the failed entry'
                        )
                      })*/
                      confirm()
                    }}
                  >
                    Save as draft
                  </Button>
                </HStack>
              </Stack.Right>
            </HStack>
          </VStack>
        </Modal>
      )}
      <Main
        scrollRef={ref}
        className={styles.root()}
        // head={<EntryHeader editor={editor} />}
      >
        <FieldToolbar.Provider>
          <EntryHeader editor={editor} />
          <Main.Container>
            <EntryTitle
              editor={editor}
              backLink={
                editor.activeVersion.parent
                  ? nav.entry({
                      entryId: editor.activeVersion.parent,
                      workspace: editor.activeVersion.workspace
                    })
                  : undefined
              }
            />

            {untranslated && (
              <EntryNotice
                icon={IcRoundTranslate}
                title="Untranslated"
                variant="untranslated"
              >
                This page has not yet been translated to this language,
                <br />
                please enter the details below and save to start translating.
              </EntryNotice>
            )}

            {mode === EditMode.Diff ? (
              <ShowChanges editor={editor} />
            ) : (
              <>
                <SuspenseBoundary name="input form">
                  <InputForm
                    key={editor.entryId + selectedPhase}
                    type={editor.type}
                    state={state}
                  />
                </SuspenseBoundary>
              </>
            )}
          </Main.Container>
          <FieldToolbar.Root />
        </FieldToolbar.Provider>
      </Main>
      {preview && !untranslated && (
        <EntryPreview preview={preview} editor={editor} />
      )}
    </>
  )
}
