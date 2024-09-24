import {EntryPhase} from 'alinea/core/EntryRow'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {TabsSection} from 'alinea/field/tabs/Tabs'
import {TabsHeader} from 'alinea/field/tabs/Tabs.view'
import {Button, HStack, Stack, VStack, fromModule} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Statusbar} from 'alinea/ui/Statusbar'
import {Tabs} from 'alinea/ui/Tabs'
import {IcOutlineTableRows} from 'alinea/ui/icons/IcOutlineTableRows'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useEffect, useRef} from 'react'
import {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {FormProvider} from '../atoms/FormAtoms.js'
import {useRouteBlocker} from '../atoms/RouterAtoms.js'
import {InputForm} from '../editor/InputForm.js'
import {useConfig} from '../hook/UseConfig.js'
import {useDashboard} from '../hook/UseDashboard.js'
import {EntryEditorProvider} from '../hook/UseEntryEditor.js'
import {useLocale} from '../hook/UseLocale.js'
import {useNav} from '../hook/UseNav.js'
import {SuspenseBoundary} from '../util/SuspenseBoundary.js'
import {Modal} from '../view/Modal.js'
import css from './EntryEdit.module.scss'
import {Preview} from './Preview.browser.js'
import {useSidebar} from './Sidebar.js'
import {EntryDiff} from './diff/EntryDiff.js'
import {EditMode} from './entry/EditModeToggle.js'
import {EntryHeader} from './entry/EntryHeader.js'
import {EntryHistory} from './entry/EntryHistory.js'
import {EntryNotice} from './entry/EntryNotice.js'
import {EntryPreview} from './entry/EntryPreview.js'
import {EntryTitle} from './entry/EntryTitle.js'
import {FieldToolbar} from './entry/FieldToolbar.js'
import {BrowserPreviewMetaProvider} from './preview/BrowserPreview.js'

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
  const {alineaDev} = useDashboard()
  const locale = useLocale()
  const config = useConfig()
  const {isPreviewOpen} = useSidebar()
  const nav = useNav()
  const mode = useAtomValue(editor.editMode)
  const hasChanges = useAtomValue(editor.hasChanges)
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({top: 0})
  }, [editor.entryId, mode, selectedPhase])
  const untranslated = locale && locale !== editor.activeVersion.locale
  const {isBlocking, nextRoute, confirm, cancel} = useRouteBlocker(
    'Are you sure you want to discard changes?',
    !untranslated && hasChanges
  )
  const isNavigationChange =
    (nextRoute?.data.editor as EntryEditor)?.entryId !== editor.entryId
  const form = useAtomValue(editor.form)
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishDraft = useSetAtom(editor.publishDraft)
  const publishEdits = useSetAtom(editor.publishEdits)
  const discardEdits = useSetAtom(editor.discardEdits)
  const showHistory = useAtomValue(editor.showHistory)
  const saveTranslation = useSetAtom(editor.saveTranslation)
  const previewRevision = useAtomValue(editor.previewRevision)
  const preview = editor.preview
  const translate = () => saveTranslation(locale!)
  useEffect(() => {
    function listener(e: KeyboardEvent) {
      const isControl = e.ctrlKey || e.metaKey
      if (isControl && e.key === 's') {
        e.preventDefault()
        if (previewRevision) {
          alert('todo')
          return
        }
        if (untranslated && hasChanges) {
          translate()
        } else if (config.enableDrafts) {
          if (hasChanges) saveDraft()
          else if (selectedPhase === EntryPhase.Draft) publishDraft()
        } else {
          if (hasChanges) publishEdits()
        }
      }
    }
    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [editor, hasChanges, saveDraft, config.enableDrafts])
  const sections = Type.sections(editor.type)
  const hasRootTabs =
    sections.length === 1 && sections[0][Section.Data] instanceof TabsSection
  const tabs: TabsSection | false =
    hasRootTabs && (sections[0][Section.Data] as TabsSection)
  const visibleTypes = tabs && tabs.types.filter(type => !Type.isHidden(type))
  useEffect(() => {
    if (isBlocking && !isNavigationChange) confirm?.()
  }, [isBlocking, isNavigationChange, confirm])
  return (
    <BrowserPreviewMetaProvider entryId={editor.entryId}>
      {alineaDev && (
        <>
          <Statusbar.Slot>
            <Statusbar.Status>
              File path: {editor.activeVersion.filePath}
            </Statusbar.Status>
          </Statusbar.Slot>
          <Statusbar.Slot>
            <Statusbar.Status>
              Parent dir: {editor.activeVersion.parentDir}
            </Statusbar.Status>
          </Statusbar.Slot>
          <Statusbar.Slot>
            <Statusbar.Status>
              Children dir: {editor.activeVersion.childrenDir}
            </Statusbar.Status>
          </Statusbar.Slot>
          <Statusbar.Slot>
            <Statusbar.Status>Url: {editor.activeVersion.url}</Statusbar.Status>
          </Statusbar.Slot>
          <Statusbar.Slot>
            <Statusbar.Status icon={IcRoundInsertDriveFile}>
              {editor.activeVersion.fileHash}
            </Statusbar.Status>
          </Statusbar.Slot>
          <Statusbar.Slot>
            <Statusbar.Status icon={IcOutlineTableRows}>
              {editor.activeVersion.rowHash}
            </Statusbar.Status>
          </Statusbar.Slot>
        </>
      )}
      {isBlocking && isNavigationChange && (
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
                  {config.enableDrafts ? (
                    <Button
                      onClick={() => {
                        saveDraft()
                        confirm()
                      }}
                    >
                      Save as draft
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        publishEdits()
                        confirm()
                      }}
                    >
                      Publish changes
                    </Button>
                  )}
                </HStack>
              </Stack.Right>
            </HStack>
          </VStack>
        </Modal>
      )}
      <Main scrollRef={ref} className={styles.root()}>
        <FieldToolbar.Provider>
          <EntryHeader editor={editor} />
          {showHistory && <EntryHistory editor={editor} />}
          <Tabs.Root>
            <EntryTitle
              editor={editor}
              backLink={
                editor.activeVersion.parent
                  ? nav.entry({
                      entryId: editor.activeVersion.parent,
                      workspace: editor.activeVersion.workspace
                    })
                  : nav.entry({entryId: undefined})
              }
            >
              {hasRootTabs && (
                <div className={styles.root.tabs()}>
                  <TabsHeader backdrop={false} section={sections[0]} />
                </div>
              )}
            </EntryTitle>
            <Main.Container>
              {untranslated && (
                <div>
                  <EntryNotice
                    icon={IcRoundTranslate}
                    title="Untranslated"
                    variant="untranslated"
                  >
                    This page has not yet been translated to this language,
                    <br />
                    {editor.parentNeedsTranslation
                      ? 'please translate the parent page first.'
                      : 'please enter the details below and save to start translating.'}
                  </EntryNotice>
                </div>
              )}
              <EntryEditorProvider editor={editor}>
                <SuspenseBoundary name="input form">
                  {mode === EditMode.Diff ? (
                    <ShowChanges editor={editor} />
                  ) : hasRootTabs && visibleTypes ? (
                    <Tabs.Panels>
                      {visibleTypes.map((type, i) => {
                        return (
                          <FormProvider form={form} key={i}>
                            <Tabs.Panel unmount={false} tabIndex={i}>
                              <InputForm type={type} />
                            </Tabs.Panel>
                          </FormProvider>
                        )
                      })}
                    </Tabs.Panels>
                  ) : (
                    <VStack gap={18}>
                      <InputForm form={form} />
                    </VStack>
                  )}
                </SuspenseBoundary>
              </EntryEditorProvider>
            </Main.Container>
          </Tabs.Root>
          <FieldToolbar.Root />
        </FieldToolbar.Provider>
      </Main>
      {preview && (
        <Preview>
          <Suspense>
            <EntryPreview preview={preview} editor={editor} />
          </Suspense>
        </Preview>
      )}
    </BrowserPreviewMetaProvider>
  )
}
