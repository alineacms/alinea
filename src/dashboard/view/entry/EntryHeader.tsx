import styler from '@alinea/styler'
import {EntryStatus} from 'alinea/core/EntryRow'
import {entryFile, workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
import {Button, HStack, Icon, px, Stack} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {Menu, MenuItem} from 'alinea/ui/Menu'
import {IcOutlineAvTimer} from 'alinea/ui/icons/IcOutlineAvTimer'
import {IcOutlineDrafts} from 'alinea/ui/icons/IcOutlineDrafts'
import {IcOutlineKeyboardTab} from 'alinea/ui/icons/IcOutlineKeyboardTab'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundArchive} from 'alinea/ui/icons/IcRoundArchive'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from 'alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundMenu} from 'alinea/ui/icons/IcRoundMenu'
import {IcRoundMoreVert} from 'alinea/ui/icons/IcRoundMoreVert'
import {IcRoundPublishedWithChanges} from 'alinea/ui/icons/IcRoundPublishedWithChanges'
import {IcRoundSave} from 'alinea/ui/icons/IcRoundSave'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {ReactNode, useState} from 'react'
import {useQueryClient} from 'react-query'
import {EntryEditor, EntryTransition} from '../../atoms/EntryEditorAtoms.js'
import {useLocation, useNavigate} from '../../atoms/LocationAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useEntryLocation} from '../../hook/UseEntryLocation.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useUploads} from '../../hook/UseUploads.js'
import {useSidebar} from '../Sidebar.js'
import {FileUploader} from '../media/FileUploader.js'
import css from './EntryHeader.module.scss'
import {Langswitch} from './LangSwitch.js'

const styles = styler(css)

const variantDescription = {
  draft: 'Draft',
  editing: 'Editing',
  published: 'Published',
  archived: 'Archived',
  untranslated: 'Untranslated',
  revision: 'Revision'
}

const transitions = {
  [EntryTransition.SaveDraft]: 'Saving',
  [EntryTransition.SaveTranslation]: 'Saving',
  [EntryTransition.PublishEdits]: 'Publishing',
  [EntryTransition.RestoreRevision]: 'Restoring',
  [EntryTransition.PublishDraft]: 'Publishing',
  [EntryTransition.DiscardDraft]: 'Discarding',
  [EntryTransition.ArchivePublished]: 'Archiving',
  [EntryTransition.PublishArchived]: 'Publishing',
  [EntryTransition.DeleteFile]: 'Deleting',
  [EntryTransition.DeleteArchived]: 'Deleting'
}

const variantIcon = {
  draft: IcOutlineDrafts,
  editing: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
  archived: IcRoundArchive,
  untranslated: IcRoundTranslate,
  revision: IcRoundPublishedWithChanges,
  transition: IcOutlineAvTimer
}

export interface EntryHeaderProps {
  editable?: boolean
  editor: EntryEditor
}

export function EntryHeader({editor, editable = true}: EntryHeaderProps) {
  const config = useConfig()
  const locale = useLocale()
  const statusInUrl = useAtomValue(editor.statusInUrl)
  const selectedStatus = useAtomValue(editor.selectedStatus)
  const previewRevision = useAtomValue(editor.previewRevision)
  const isActiveStatus = editor.activeStatus === selectedStatus
  const isMediaFile = editor.activeVersion.type === 'MediaFile'
  const isMediaLibrary = editor.activeVersion.type === 'MediaLibrary'
  const hasChanges = useAtomValue(editor.hasChanges)
  const currentTransition = useAtomValue(editor.transition)?.transition
  const untranslated = locale && locale !== editor.activeVersion.locale
  const variant = currentTransition
    ? 'transition'
    : previewRevision
    ? 'revision'
    : untranslated
    ? 'untranslated'
    : hasChanges && !statusInUrl
    ? 'editing'
    : selectedStatus
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishEdits = useSetAtom(editor.publishEdits)
  const publishDraft = useSetAtom(editor.publishDraft)
  const restoreRevision = useSetAtom(editor.restoreRevision)
  const discardDraft = useSetAtom(editor.discardDraft)
  const archivePublished = useSetAtom(editor.archivePublished)
  const publishArchived = useSetAtom(editor.publishArchived)
  const deleteArchived = useSetAtom(editor.deleteArchived)
  const deleteFile = useSetAtom(editor.deleteFile)
  const deleteMediaLibrary = useSetAtom(editor.deleteMediaLibrary)
  const queryClient = useQueryClient()
  function deleteFileAndNavigate() {
    return deleteFile()?.then(() => {
      queryClient.invalidateQueries('explorer')
      navigate(nav.root(entryLocation))
    })
  }
  function deleteMediaLibraryAndNavigate() {
    return deleteMediaLibrary()?.then(() => {
      queryClient.invalidateQueries('explorer')
      navigate(nav.root(entryLocation))
    })
  }
  const saveTranslation = useSetAtom(editor.saveTranslation)
  const discardEdits = useSetAtom(editor.discardEdits)
  const translate = () => saveTranslation(locale!)
  const [showHistory, setShowHistory] = useAtom(editor.showHistory)
  const entryLocation = useEntryLocation()
  const navigate = useNavigate()
  const nav = useNav()
  const {pathname} = useLocation()
  const {isPreviewOpen, toggleNav, togglePreview} = useSidebar()
  const [isReplacing, setIsReplacing] = useState(false)
  const {upload} = useUploads()
  function replaceFile() {
    setIsReplacing(true)
    const input = document.createElement('input')
    input.type = 'file'
    const extension = editor.activeVersion.data.extension
    input.accept = extension
    input.onchange = async () => {
      const file = input.files![0]
      const destination = {
        parentId: editor.activeVersion.parentId ?? undefined,
        workspace: editor.activeVersion.workspace,
        root: editor.activeVersion.root,
        directory: workspaceMediaDir(config, editor.activeVersion.workspace)
      }
      await upload([file], destination, {
        entry: editor.activeVersion,
        entryFile: entryFile(config, editor.activeVersion)
      })
    }
    input.click()
  }

  const menuItems: Array<{id: string; action(): void; label: ReactNode}> = []
  if (!isMediaFile) {
    menuItems.push({
      id: 'history',
      action: () => setShowHistory(!showHistory),
      label: `${showHistory ? 'Hide' : 'Show'} history`
    })
  }
  if (variant === 'draft') {
    menuItems.push({id: 'draft', action: discardDraft, label: 'Remove draft'})
  } else if (
    variant === EntryStatus.Published &&
    !editor.activeVersion.seeded
  ) {
    if (isMediaFile) {
      menuItems.push({id: 'replace', action: replaceFile, label: 'Replace'})
      menuItems.push({
        id: 'delete',
        action: deleteFileAndNavigate,
        label: 'Delete'
      })
    } else {
      menuItems.push({
        id: 'archive',
        action: archivePublished,
        label: 'Archive'
      })
    }
  } else if (variant === EntryStatus.Archived) {
    menuItems.push({id: 'publish', action: publishArchived, label: 'Publish'})
    menuItems.push({id: 'delete', action: deleteArchived, label: 'Delete'})
  }

  return (
    <>
      {isReplacing && <FileUploader />}
      <AppBar.Root className={styles.root()} variant={variant}>
        <HStack center gap={12} className={styles.root.description()}>
          <button
            title="Display menu"
            onClick={() => toggleNav()}
            className={styles.root.menuToggle()}
          >
            <Icon icon={IcRoundMenu} />
          </button>

          <Icon icon={variantIcon[variant]} size={18} />

          <Menu
            onAction={href => navigate(href as string)}
            label={
              <HStack center gap={4}>
                <span>
                  {variant === 'transition'
                    ? transitions[currentTransition!]
                    : variantDescription[variant]}
                </span>
                {!previewRevision && editor.availableStatuses.length > 1 && (
                  <Icon icon={IcRoundUnfoldMore} />
                )}
              </HStack>
            }
          >
            {hasChanges && <MenuItem id={pathname}>Editing</MenuItem>}
            {!previewRevision &&
              editor.availableStatuses.map(status => {
                return (
                  <MenuItem key={status} id={`${pathname}?${status}`}>
                    {variantDescription[status]}
                  </MenuItem>
                )
              })}
          </Menu>

          {editable &&
            !currentTransition &&
            !hasChanges &&
            isActiveStatus &&
            !untranslated &&
            !previewRevision && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  Edit to create a new draft
                </div>
              </>
            )}

          {!currentTransition &&
            !hasChanges &&
            !isActiveStatus &&
            editor.availableStatuses.includes(EntryStatus.Draft) && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  A newer draft version is available
                </div>
              </>
            )}

          {!currentTransition &&
            untranslated &&
            !editor.parentNeedsTranslation &&
            !hasChanges && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  <HStack center>
                    <span style={{marginRight: px(8)}}>Translate from</span>
                    <Langswitch
                      selected={editor.activeVersion.locale!}
                      locales={editor.translations.map(({locale}) => locale)}
                      onChange={locale => {
                        navigate(pathname + `?from=` + locale)
                      }}
                    />
                  </HStack>
                </div>
              </>
            )}

          {!currentTransition &&
            untranslated &&
            editor.parentNeedsTranslation && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  Translate parent page first
                </div>
              </>
            )}

          {variant === 'editing' && (
            <>
              <span className={styles.root.description.separator()} />

              <div className={styles.root.description.action()}>
                <button
                  className={styles.root.description.action.button()}
                  onClick={discardEdits}
                >
                  <Icon icon={IcRoundDelete} />
                  <span>Discard edits</span>
                </button>
              </div>
            </>
          )}

          <Stack.Right>
            <HStack center gap={12}>
              {!currentTransition && (
                <>
                  {untranslated && !editor.parentNeedsTranslation && (
                    <Button icon={IcRoundSave} onClick={translate}>
                      Save translation
                    </Button>
                  )}
                  {config.enableDrafts && variant === 'editing' && (
                    <Button icon={IcRoundSave} onClick={saveDraft}>
                      Save draft
                    </Button>
                  )}
                  {!config.enableDrafts && variant === 'editing' && (
                    <Button icon={IcRoundSave} onClick={publishEdits}>
                      Publish
                    </Button>
                  )}
                  {!untranslated &&
                    !hasChanges &&
                    selectedStatus === 'draft' && (
                      <Button icon={IcRoundCheck} onClick={publishDraft}>
                        Publish draft
                      </Button>
                    )}
                  {variant === 'revision' && (
                    <Button icon={IcRoundSave} onClick={restoreRevision}>
                      Restore
                    </Button>
                  )}

                  <Menu
                    placement="bottom right"
                    label={
                      <div className={styles.root.more(variant)}>
                        <Icon icon={IcRoundMoreVert} />
                      </div>
                    }
                    onAction={id => {
                      menuItems.find(item => item.id === id)?.action()
                    }}
                  >
                    {menuItems.map(({id, label}) => {
                      return (
                        <MenuItem key={id} id={id}>
                          {label}
                        </MenuItem>
                      )
                    })}
                  </Menu>
                </>
              )}
              <button
                title="Display preview"
                onClick={() => togglePreview()}
                style={{cursor: 'pointer'}}
              >
                <Icon
                  icon={IcOutlineKeyboardTab}
                  style={{
                    transform: `rotate(${isPreviewOpen ? 0 : 180}deg)`
                  }}
                />
              </button>
            </HStack>
          </Stack.Right>
        </HStack>
      </AppBar.Root>
    </>
  )
}
