import styler from '@alinea/styler'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {TabsSection} from 'alinea/field/tabs/Tabs'
import {TabsHeader} from 'alinea/field/tabs/Tabs.view'
import {Button, HStack, Stack, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Statusbar} from 'alinea/ui/Statusbar'
import {Tabs} from 'alinea/ui/Tabs'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundLink} from 'alinea/ui/icons/IcRoundLink'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useEffect, useRef, useState} from 'react'
import type {EntryEditor} from '../atoms/EntryEditorAtoms.js'
import {FormProvider} from '../atoms/FormAtoms.js'
import {useRouteBlocker} from '../atoms/RouterAtoms.js'
import {InputForm} from '../editor/InputForm.js'
import {useConfig} from '../hook/UseConfig.js'
import {useDashboard} from '../hook/UseDashboard.js'
import {EntryEditorProvider} from '../hook/UseEntryEditor.js'
import {useLocale} from '../hook/UseLocale.js'
import {useTranslation} from '../hook/useTranslation.js'
import {useNav} from '../hook/UseNav.js'
import {SuspenseBoundary} from '../util/SuspenseBoundary.js'
import {Modal} from '../view/Modal.js'
import css from './EntryEdit.module.scss'
import {Preview} from './Preview.js'
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

const styles = styler(css)

export const copy = {
  blockingTitle: 'Are you sure you want to discard changes?',
  blockingWarning: 'This document was changed',
  blockingPrompt: 'would you like to save your changes?',
  blockingDiscard: 'Discard my changes',
  blockingSaveDraft: 'Save as draft',
  blockingPublishChanges: 'Publish changes',
  untranslatedTitle: 'Untranslated',
  untranslatedParent: 'Translate the parent page first.',
  untranslatedPrompt: 'Enter the details below and save to start translating.'
}

function ShowChanges({editor}: EntryEditProps) {
  const draftEntry = useAtomValue(editor.draftEntry)
  const hasChanges = useAtomValue(editor.hasChanges)
  const compareTo = hasChanges
    ? editor.activeVersion
    : editor.statuses[
        editor.availableStatuses.find(status => status !== 'draft')!
      ]
  return <EntryDiff entryA={compareTo} entryB={draftEntry} />
}

export interface EntryEditProps {
  editor: EntryEditor
}

export function EntryEdit({editor}: EntryEditProps) {
  const {alineaDev} = useDashboard()
  const t = useTranslation(copy)
  const locale = useLocale()
  const config = useConfig()
  const {isPreviewOpen} = useSidebar()
  const nav = useNav()
  const [rootTab, setRootTab] = useState<number>()
  const mode = useAtomValue(editor.editMode)
  const hasChanges = useAtomValue(editor.hasChanges)
  const selectedStatus = useAtomValue(editor.selectedStatus)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({top: 0})
  }, [editor.entryId, mode, selectedStatus])
  const {isBlocking, nextRoute, confirm, cancel} = useRouteBlocker(
    t.blockingTitle,
    !editor.untranslated && hasChanges
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
        if (editor.untranslated && hasChanges) {
          translate()
        } else if (config.enableDrafts) {
          if (hasChanges) saveDraft()
          else if (selectedStatus === 'draft') publishDraft()
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
  const tabs: TabsSection | undefined = hasRootTabs
    ? (sections[0][Section.Data] as TabsSection)
    : undefined
  const visibleTypes = tabs?.types.filter(type => !Type.isHidden(type))

  let selectedRootTab = 0
  if (hasRootTabs && visibleTypes && rootTab !== undefined) {
    selectedRootTab = rootTab
    if (rootTab >= visibleTypes.length) selectedRootTab = 0
  }

  useEffect(() => {
    if (isBlocking && !isNavigationChange) confirm?.()
  }, [isBlocking, isNavigationChange, confirm])
  return (
    <BrowserPreviewMetaProvider entryId={editor.entryId}>
      {alineaDev && (
        <>
          <Statusbar.Slot>
            <Statusbar.Status icon={IcRoundInsertDriveFile}>
              {editor.activeVersion.filePath} @{' '}
              {editor.activeVersion.fileHash.slice(0, 8)}
            </Statusbar.Status>
          </Statusbar.Slot>
          <Statusbar.Slot>
            <Statusbar.Status icon={IcRoundLink}>
              {editor.activeVersion.url}
            </Statusbar.Status>
          </Statusbar.Slot>
        </>
      )}
      {isBlocking && isNavigationChange && (
        <Modal open onClose={() => cancel()}>
          <VStack gap={30}>
            <p>
              {t.blockingWarning},
              <br />
              {t.blockingPrompt}
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
                    {t.blockingDiscard}
                  </Button>
                  {config.enableDrafts ? (
                    <Button
                      onClick={() => {
                        saveDraft()
                        confirm()
                      }}
                    >
                      {t.blockingSaveDraft}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        publishEdits()
                        confirm()
                      }}
                    >
                      {t.blockingPublishChanges}
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
          <Tabs.Root
            style={{flex: 1}}
            selectedIndex={selectedRootTab}
            onChange={index => setRootTab(index)}
          >
            <EntryTitle
              editor={editor}
              backLink={
                editor.activeVersion.parentId
                  ? nav.entry({
                      id: editor.activeVersion.parentId,
                      workspace: editor.activeVersion.workspace
                    })
                  : nav.entry({id: undefined})
              }
            >
              {hasRootTabs && (
                <div className={styles.root.tabs()}>
                  <TabsHeader backdrop={false} section={sections[0]} />
                </div>
              )}
            </EntryTitle>
            <Main.Container>
              {editor.untranslated && (
                <div>
                  <EntryNotice
                    icon={IcRoundTranslate}
                    title={t.untranslatedTitle}
                    variant="untranslated"
                  >
                    {editor.parentNeedsTranslation
                      ? t.untranslatedParent
                      : t.untranslatedPrompt}
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
