import styler from '@alinea/styler'
import {workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
import {Button, HStack, Icon, Stack, px} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
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
import {useState} from 'react'
import {useQueryClient} from 'react-query'
import {
  type EntryEditor,
  EntryTransition
} from '../../atoms/EntryEditorAtoms.js'
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
  const {canPublish, untranslated, parentNeedsTranslation} = editor
  const statusInUrl = useAtomValue(editor.statusInUrl)
  const selectedStatus = useAtomValue(editor.selectedStatus)
  const previewRevision = useAtomValue(editor.previewRevision)
  const isActiveStatus = editor.activeStatus === selectedStatus
  const isMediaFile = editor.activeVersion.type === 'MediaFile'
  const isMediaLibrary = editor.activeVersion.type === 'MediaLibrary'
  const hasChanges = useAtomValue(editor.hasChanges)
  const currentTransition = useAtomValue(editor.transition)
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
      await upload([file], destination, editor.entryId)
    }
    input.click()
  }

  const options =
    variant === 'draft' ? (
      <DropdownMenu.Item
        className={styles.root.action()}
        onClick={discardDraft}
      >
        Remove draft
      </DropdownMenu.Item>
    ) : variant === 'published' && !editor.activeVersion.seeded ? (
      isMediaFile ? (
        <>
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={replaceFile}
          >
            Replace
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={deleteFileAndNavigate}
          >
            Delete
          </DropdownMenu.Item>
        </>
      ) : isMediaLibrary ? (
        <>
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={deleteMediaLibraryAndNavigate}
          >
            Delete
          </DropdownMenu.Item>
        </>
      ) : (
        <DropdownMenu.Item
          className={styles.root.action()}
          onClick={archivePublished}
        >
          Archive
        </DropdownMenu.Item>
      )
    ) : variant === 'archived' ? (
      <>
        {canPublish && (
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={publishArchived}
          >
            Publish
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          className={styles.root.action()}
          onClick={deleteArchived}
        >
          Delete
        </DropdownMenu.Item>
      </>
    ) : null
  return (
    <>
      {isReplacing && <FileUploader />}
      <AppBar.Root className={styles.root()} variant={variant}>
        <HStack center gap={12} className={styles.root.description()}>
          <button
            type="button"
            title="Display menu"
            onClick={() => toggleNav()}
            className={styles.root.menuToggle()}
          >
            <Icon icon={IcRoundMenu} />
          </button>

          <Icon icon={variantIcon[variant]} size={18} />

          <DropdownMenu.Root bottom>
            <DropdownMenu.Trigger className={styles.root.description.title()}>
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
            </DropdownMenu.Trigger>
            <DropdownMenu.Items>
              {hasChanges && (
                <DropdownMenu.Item
                  onClick={() => {
                    navigate(pathname)
                  }}
                >
                  Editing
                </DropdownMenu.Item>
              )}
              {!previewRevision &&
                editor.availableStatuses.map(status => {
                  return (
                    <DropdownMenu.Item
                      key={status}
                      onClick={() => {
                        navigate(`${pathname}?${status}`)
                      }}
                    >
                      {variantDescription[status]}
                    </DropdownMenu.Item>
                  )
                })}
            </DropdownMenu.Items>
          </DropdownMenu.Root>

          {editable &&
            !currentTransition &&
            !hasChanges &&
            isActiveStatus &&
            !untranslated &&
            !previewRevision &&
            canPublish && (
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
            editor.availableStatuses.includes('draft') && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  A newer draft version is available
                </div>
              </>
            )}

          {!currentTransition &&
            untranslated &&
            !parentNeedsTranslation &&
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
                        navigate(`${pathname}?from=${locale}`)
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
                  type="button"
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

                  <DropdownMenu.Root bottom left>
                    <DropdownMenu.Trigger className={styles.root.more(variant)}>
                      <Icon icon={IcRoundMoreVert} />
                    </DropdownMenu.Trigger>

                    <DropdownMenu.Items>
                      {!isMediaFile && !isMediaLibrary && (
                        <DropdownMenu.Item
                          onClick={() => setShowHistory(!showHistory)}
                        >
                          {showHistory ? 'Hide' : 'Show'} history
                        </DropdownMenu.Item>
                      )}
                      {options}
                    </DropdownMenu.Items>
                  </DropdownMenu.Root>
                </>
              )}
              <button
                type="button"
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
