import styler from '@alinea/styler'
import {workspaceMediaDir} from 'alinea/core/util/EntryFilenames'
import {Button, HStack, Icon, px, Stack} from 'alinea/ui'
import {AppBar} from 'alinea/ui/AppBar'
import {DropdownMenu} from 'alinea/ui/DropdownMenu'
import {IcOutlineArchive} from 'alinea/ui/icons/IcOutlineArchive'
import {IcOutlineAvTimer} from 'alinea/ui/icons/IcOutlineAvTimer'
import {IcOutlineKeyboardTab} from 'alinea/ui/icons/IcOutlineKeyboardTab'
import {IcOutlineRemoveRedEye} from 'alinea/ui/icons/IcOutlineRemoveRedEye'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundDelete} from 'alinea/ui/icons/IcRoundDelete'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundLastPage} from 'alinea/ui/icons/IcRoundLastPage'
import {IcRoundMenu} from 'alinea/ui/icons/IcRoundMenu'
import {IcRoundMoreVert} from 'alinea/ui/icons/IcRoundMoreVert'
import {IcRoundPublishedWithChanges} from 'alinea/ui/icons/IcRoundPublishedWithChanges'
import {IcRoundSave} from 'alinea/ui/icons/IcRoundSave'
import {IcRoundTranslate} from 'alinea/ui/icons/IcRoundTranslate'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useState} from 'react'
import {useQueryClient} from 'react-query'
import {
  type EntryEditor,
  EntryTransition
} from '../../atoms/EntryEditorAtoms.js'
import {useLocation, useNavigate} from '../../atoms/LocationAtoms.js'
import {useConfig} from '../../hook/UseConfig.js'
import {useTranslation} from '../../hook/useTranslation.js'
import {useEntryLocation} from '../../hook/UseEntryLocation.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useUploads} from '../../hook/UseUploads.js'
import {FileUploader} from '../media/FileUploader.js'
import {useSidebar} from '../Sidebar.js'
import css from './EntryHeader.module.scss'
import {Langswitch} from './LangSwitch.js'

const styles = styler(css)

export const copy = {
  variant: {
    draft: 'Draft',
    editing: 'Editing',
    published: 'Published',
    archived: 'Archived',
    untranslated: 'Untranslated',
    revision: 'Revision',
    unpublished: 'Unpublished'
  },
  transition: {
    [EntryTransition.SaveDraft]: 'Saving',
    [EntryTransition.SaveTranslation]: 'Saving',
    [EntryTransition.PublishEdits]: 'Publishing',
    [EntryTransition.RestoreRevision]: 'Restoring',
    [EntryTransition.PublishDraft]: 'Publishing',
    [EntryTransition.UnpublishDraft]: 'Unpublishing',
    [EntryTransition.DiscardDraft]: 'Discarding',
    [EntryTransition.ArchivePublished]: 'Archiving',
    [EntryTransition.PublishArchived]: 'Publishing',
    [EntryTransition.DeleteFile]: 'Deleting',
    [EntryTransition.DeleteEntry]: 'Deleting'
  },
  menu: {
    show: 'Display menu',
    hide: 'Hide menu'
  },
  options: {
    removeDraft: 'Remove draft',
    replace: 'Replace',
    delete: 'Delete',
    unpublish: 'Unpublish',
    archive: 'Archive',
    publish: 'Publish',
    history: {
      show: 'Show history',
      hide: 'Hide history'
    }
  },
  prompt: {
    draftAvailable: 'A newer draft version is available',
    translateFrom: 'Translate from',
    translateParent: 'Translate parent page first'
  },
  discard: 'Discard edits',
  save: 'Save translation',
  publish: 'Publish',
  saveDraft: 'Save',
  restore: 'Restore',
  preview: {
    show: 'Display preview',
    hide: 'Hide preview'
  }
}

const variantIcon = {
  draft: IcRoundEdit,
  editing: IcRoundEdit,
  published: IcOutlineRemoveRedEye,
  archived: IcOutlineArchive,
  untranslated: IcRoundTranslate,
  revision: IcRoundPublishedWithChanges,
  transition: IcOutlineAvTimer,
  unpublished: RiFlashlightFill
}

export interface EntryHeaderProps {
  editable?: boolean
  editor: EntryEditor
}

export function EntryHeader({editor, editable = true}: EntryHeaderProps) {
  const t = useTranslation(copy)
  const config = useConfig()
  const locale = useLocale()
  const {canPublish, canDelete, untranslated, parentNeedsTranslation} = editor
  const statusInUrl = useAtomValue(editor.statusInUrl)
  const selectedStatus = useAtomValue(editor.selectedStatus)
  const previewRevision = useAtomValue(editor.previewRevision)
  const isActiveStatus = editor.activeStatus === selectedStatus
  const isMediaFile = editor.activeVersion.type === 'MediaFile'
  const isMediaLibrary = editor.activeVersion.type === 'MediaLibrary'
  const hasChanges = useAtomValue(editor.hasChanges)
  const currentTransition = useAtomValue(editor.transition)
  const variant =
    currentTransition !== undefined
      ? 'transition'
      : previewRevision
        ? 'revision'
        : untranslated
          ? 'untranslated'
          : hasChanges && !statusInUrl
            ? 'editing'
            : selectedStatus === 'draft' && editor.activeVersion.main
              ? 'unpublished'
              : selectedStatus
  const saveDraft = useSetAtom(editor.saveDraft)
  const publishEdits = useSetAtom(editor.publishEdits)
  const publishDraft = useSetAtom(editor.publishDraft)
  const restoreRevision = useSetAtom(editor.restoreRevision)
  const discardDraft = useSetAtom(editor.discardDraft)
  const unPublish = useSetAtom(editor.unPublish)
  const archive = useSetAtom(editor.archive)
  const publishArchived = useSetAtom(editor.publishArchived)
  const deleteEntry = useSetAtom(editor.deleteEntry)
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
  const {isNavOpen, isPreviewOpen, toggleNav, togglePreview} = useSidebar()
  const [isReplacing, setIsReplacing] = useState(false)
  const {upload} = useUploads()
  function replaceFile() {
    setIsReplacing(true)
    const input = document.createElement('input')
    input.type = 'file'
    const extension = editor.activeVersion.data.extension
    input.accept = extension as string
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
  const isParentUnpublished = editor.parents.some(p => p.status === 'draft')
  const options =
    variant === 'draft' ? (
      <DropdownMenu.Item
        className={styles.root.action()}
        onClick={discardDraft}
      >
        {t.options.removeDraft}
      </DropdownMenu.Item>
    ) : variant === 'published' && !editor.activeVersion.seeded ? (
      isMediaFile ? (
        <>
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={replaceFile}
          >
            {t.options.replace}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={deleteFileAndNavigate}
          >
            {t.options.delete}
          </DropdownMenu.Item>
        </>
      ) : isMediaLibrary ? (
        <>
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={deleteMediaLibraryAndNavigate}
          >
            {t.options.delete}
          </DropdownMenu.Item>
        </>
      ) : (
        <>
          {config.enableDrafts && (
            <DropdownMenu.Item
              className={styles.root.action()}
              onClick={unPublish}
            >
              {t.options.unpublish}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={styles.root.action()} onClick={archive}>
            {t.options.archive}
          </DropdownMenu.Item>
        </>
      )
    ) : variant === 'archived' ? (
      <>
        {canPublish && (
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={publishArchived}
          >
            {t.options.publish}
          </DropdownMenu.Item>
        )}
        {canDelete && (
          <DropdownMenu.Item
            className={styles.root.action()}
            onClick={deleteEntry}
          >
            {t.options.delete}
          </DropdownMenu.Item>
        )}
      </>
    ) : variant === 'unpublished' ? (
      isParentUnpublished ? (
        <DropdownMenu.Item
          className={styles.root.action()}
          onClick={deleteEntry}
        >
          {t.options.delete}
        </DropdownMenu.Item>
      ) : (
        <DropdownMenu.Item className={styles.root.action()} onClick={archive}>
          {t.options.archive}
        </DropdownMenu.Item>
      )
    ) : null
  const inTransition = currentTransition !== undefined
  return (
    <>
      {isReplacing && <FileUploader />}
      <AppBar.Root className={styles.root()} variant={variant}>
        <HStack center gap={12} className={styles.root.description()}>
          <button
            type="button"
            onClick={() => toggleNav()}
            title={!isNavOpen ? t.menu.show : t.menu.hide}
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
                    ? t.transition[currentTransition!]
                    : t.variant[variant]}
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
                  {t.variant.editing}
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
                      {t.variant[status]}
                    </DropdownMenu.Item>
                  )
                })}
            </DropdownMenu.Items>
          </DropdownMenu.Root>

          {/*editable &&
            !inTransition &&
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
            )*/}

          {!inTransition &&
            !hasChanges &&
            !isActiveStatus &&
            editor.availableStatuses.includes('draft') && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  {t.prompt.draftAvailable}
                </div>
              </>
            )}

          {!inTransition &&
            untranslated &&
            !parentNeedsTranslation &&
            !hasChanges && (
              <>
                <span className={styles.root.description.separator()} />
                <div className={styles.root.description.action()}>
                  <HStack center>
                    <span style={{marginRight: px(8)}}>
                      {t.prompt.translateFrom}
                    </span>
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

          {!inTransition && untranslated && editor.parentNeedsTranslation && (
            <>
              <span className={styles.root.description.separator()} />
              <div className={styles.root.description.action()}>
                {t.prompt.translateParent}
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
                  <span>{t.discard}</span>
                </button>
              </div>
            </>
          )}

          <Stack.Right>
            <HStack center gap={12}>
              {!inTransition && (
                <>
                  {untranslated && !editor.parentNeedsTranslation && (
                    <Button icon={IcRoundSave} onClick={translate}>
                      {t.save}
                    </Button>
                  )}
                  {variant === 'editing' && canPublish && (
                    <Button icon={IcRoundCheck} onClick={publishEdits}>
                      {t.publish}
                    </Button>
                  )}
                  {!untranslated &&
                    !hasChanges &&
                    canPublish &&
                    selectedStatus === 'draft' && (
                      <Button
                        icon={IcRoundCheck}
                        onClick={publishDraft}
                        className={styles.root.main({
                          unpublished: variant === 'unpublished'
                        })}
                      >
                        {t.publish}
                      </Button>
                    )}
                  {config.enableDrafts && variant === 'editing' && (
                    <Button outline icon={IcRoundSave} onClick={saveDraft}>
                      {t.saveDraft}
                    </Button>
                  )}
                  {variant === 'revision' && (
                    <Button icon={IcRoundSave} onClick={restoreRevision}>
                      {t.restore}
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
                          {showHistory ? t.options.history.hide : t.options.history.show}
                        </DropdownMenu.Item>
                      )}
                      {options}
                    </DropdownMenu.Items>
                  </DropdownMenu.Root>
                </>
              )}
              <button
                type="button"
                onClick={() => togglePreview()}
                title={isPreviewOpen ? t.preview.hide : t.preview.show}
                className={styles.root.previewToggle()}
              >
                <Icon
                  icon={IcRoundLastPage}
                  style={{
                    transform: `rotate(${isPreviewOpen ? 180 : 0}deg)`
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
