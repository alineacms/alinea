import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {
  EntryUrlConflictError,
  type EntryUrlConflictErrorInfo
} from '#/core/db/EntryUrlConflictError.js'
import {getType} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {isRecord} from '#/core/util/Objects.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {ComponentType, type ReactNode, useState} from 'react'
import {usePolicy} from '../hooks.js'
import {
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundMoreHoriz,
  IcRoundPublishedWithChanges,
  IcRoundSave,
  IcRoundSync,
  IcRoundVisibilityOff
} from '../icons.js'
import {ReactiveNode} from '../atoms/entry/editor.js'
import type {EntryDataAtoms} from '../atoms/entry.js'
import type {EntryPageData} from '../atoms/entry/load.js'
import {mutationQueueAtom} from '../atoms/graph/queue.js'
import {routeAtom} from '../atoms/routing.js'
import {configAtom} from '../atoms/config.js'
import {Badge} from './Badge.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {StatusBadge} from './StatusBadge.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface EntryHeaderProps {
  controls?: ReactNode
  entry: EntryDataAtoms
  page: EntryPageData
  isSidebarOpen?: boolean
  node: ReactiveNode<object>
  onSidebarOpenChange?: (isOpen: boolean) => void
}

interface EntryHeaderActionProps {
  entry: EntryDataAtoms
  page: EntryPageData
  node: ReactiveNode<object>
  activeStatus: 'draft' | 'published' | 'archived'
  isDirty: boolean
  isUnpublished: boolean
  isSidebarOpen?: boolean
  onSidebarOpenChange?: (isOpen: boolean) => void
  untranslated: boolean
  parentNeedsTranslation: boolean
}

interface EntryHeaderMoreActionsProps {
  entry: EntryDataAtoms
  page: EntryPageData
  activeStatus: 'draft' | 'published' | 'archived'
  isDirty: boolean
  isUnpublished: boolean
  untranslated: boolean
}

interface EntryHeaderMenuItem {
  id: string
  label: string
  action: () => void | Promise<void>
  icon?: ComponentType
}

interface EntryHeaderBackButtonProps {
  entry: EntryDataAtoms
}

function EntryHeaderBackButton({entry}: EntryHeaderBackButtonProps) {
  const route = useAtomValue(routeAtom)
  const {parentId, workspace, root} = useAtomValue(entry.entryData)
  const setRoute = useSetAtom(routeAtom)
  return (
    <EditorBackButton
      label={parentId ? 'Back to parent entry' : 'Back to root'}
      onPress={() => {
        setRoute({
          workspace,
          root,
          entry: parentId ?? undefined,
          locale: route.locale
        })
      }}
    />
  )
}

function EntryHeaderMoreActions({
  entry,
  page,
  activeStatus,
  isDirty,
  isUnpublished,
  untranslated
}: EntryHeaderMoreActionsProps) {
  const policy = usePolicy()
  const config = useAtomValue(configAtom)
  const activeVersion = page.languageVersion
  const type = useAtomValue(entry.type)
  const canPublishParents = useAtomValue(entry.canPublish)
  const isParentUnpublished = useAtomValue(entry.parentUnpublished)
  const selectedVersion = useAtomValue(entry.selectedVersion)
  const discardDraft = useSetAtom(entry.discardDraft)
  const unpublish = useSetAtom(entry.unpublish)
  const archive = useSetAtom(entry.archive)
  const publishArchived = useSetAtom(entry.publishArchived)
  const deleteEntry = useSetAtom(entry.deleteEntry)
  const replaceFile = useSetAtom(entry.replaceFile)
  const mutationQueue = useAtomValue(mutationQueueAtom)
  const access = policy.get(activeVersion)
  const canDelete = activeVersion.seeded === null
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState<Error>()
  const [urlConflict, setUrlConflict] = useState<EntryUrlConflictErrorInfo>()
  const isActionDisabled = isPending || mutationQueue.failed > 0
  const isRevision = selectedVersion.type === 'history'
  const menuItems: Array<EntryHeaderMenuItem> = []

  async function runAction(action: () => void | Promise<void>) {
    if (mutationQueue.failed > 0) return
    setIsPending(true)
    try {
      await action()
    } catch (cause) {
      const conflict = entryUrlConflictInfo(cause)
      if (conflict) {
        setUrlConflict(conflict)
        return
      }
      setActionError(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      setIsPending(false)
    }
  }

  if (actionError) throw actionError

  async function deleteAndNavigate() {
    await deleteEntry()
  }

  function replaceMediaFile() {
    const input = document.createElement('input')
    input.type = 'file'
    const extension = activeVersion.data.extension
    if (typeof extension === 'string') input.accept = extension
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) runAction(() => replaceFile(file))
    }
    input.click()
  }

  if (!isRevision && !isDirty && !untranslated) {
    if (activeStatus === 'draft') {
      if (isUnpublished) {
        if (isParentUnpublished && canDelete && access.delete) {
          menuItems.push({
            id: 'delete',
            label: 'Delete',
            action: deleteAndNavigate,
            icon: IcRoundDelete
          })
        }
        if (!isParentUnpublished && access.archive) {
          menuItems.push({
            id: 'archive',
            label: 'Archive',
            action: archive,
            icon: IcRoundArchive
          })
        }
      } else if (access.update) {
        menuItems.push({
          id: 'remove-draft',
          label: 'Remove draft',
          action: discardDraft,
          icon: IcRoundDelete
        })
      }
    }

    if (activeStatus === 'published') {
      if (isMediaFile) {
        if (access.update && access.upload) {
          menuItems.push({
            id: 'replace',
            label: 'Replace',
            action: replaceMediaFile,
            icon: IcRoundSync
          })
        }
        if (canDelete && access.delete) {
          menuItems.push({
            id: 'delete',
            label: 'Delete',
            action: deleteAndNavigate,
            icon: IcRoundDelete
          })
        }
      } else {
        if (!isMediaLibrary && config.enableDrafts && access.publish) {
          menuItems.push({
            id: 'unpublish',
            label: 'Unpublish',
            action: unpublish,
            icon: IcRoundVisibilityOff
          })
        }
        if (canDelete && access.archive) {
          menuItems.push({
            id: 'archive',
            label: 'Archive',
            action: archive,
            icon: IcRoundArchive
          })
        }
      }
    }

    if (activeStatus === 'archived') {
      if (canPublishParents && access.publish) {
        menuItems.push({
          id: 'publish',
          label: 'Publish',
          action: publishArchived,
          icon: IcRoundCheck
        })
      }
      if (canDelete && access.delete) {
        menuItems.push({
          id: 'delete',
          label: 'Delete',
          action: deleteAndNavigate,
          icon: IcRoundDelete
        })
      }
    }
  }

  if (menuItems.length === 0) return null
  return (
    <>
      <Menu
        label={
          <Button
            size="icon"
            appearance="plain"
            aria-label="More actions"
            icon={IcRoundMoreHoriz}
            isDisabled={isActionDisabled}
            isPending={isPending}
          />
        }
        aria-label="More actions"
        popoverProps={{placement: 'bottom start'}}
      >
        {menuItems.map(item => (
          <MenuItem
            key={item.id}
            id={item.id}
            textValue={item.label}
            isDisabled={isActionDisabled}
            onAction={() => {
              runAction(item.action)
            }}
          >
            {item.icon && <Icon icon={item.icon} />}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
      <UrlConflictModal
        conflict={urlConflict}
        onClose={() => setUrlConflict(undefined)}
      />
    </>
  )
}

interface UrlConflictModalProps {
  conflict?: EntryUrlConflictErrorInfo
  onClose(): void
}

function UrlConflictModal({conflict, onClose}: UrlConflictModalProps) {
  return (
    <DashboardModal
      isOpen={Boolean(conflict)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {conflict && (
        <DashboardModalDialog label="URL alias already in use">
          <DashboardModalContent>
            <p>
              The URL alias <strong>{conflict.url}</strong> is already defined
              on entry <strong>{conflict.entryId}</strong>.
            </p>
            <p>Remove or change this alias, then publish again.</p>
          </DashboardModalContent>
          <DashboardModalFooter>
            <Button intent="primary" onPress={onClose}>
              OK
            </Button>
          </DashboardModalFooter>
        </DashboardModalDialog>
      )}
    </DashboardModal>
  )
}

function entryUrlConflictInfo(
  error: unknown
): EntryUrlConflictErrorInfo | undefined {
  if (error instanceof EntryUrlConflictError) return error.info
  if (!isRecord(error)) return undefined
  if (error.name !== 'EntryUrlConflictError') return undefined
  const info = error.info
  if (!isRecord(info)) return undefined
  if (
    typeof info.url === 'string' &&
    typeof info.entryId === 'string' &&
    typeof info.workspace === 'string' &&
    typeof info.root === 'string'
  ) {
    return {
      url: info.url,
      entryId: info.entryId,
      workspace: info.workspace,
      root: info.root
    }
  }
}

function EntryHeaderActions({
  entry,
  page,
  node,
  activeStatus,
  isDirty,
  isSidebarOpen,
  onSidebarOpenChange,
  untranslated,
  parentNeedsTranslation
}: EntryHeaderActionProps) {
  const policy = usePolicy()
  const config = useAtomValue(configAtom)
  const activeVersion = page.languageVersion
  const canPublishParents = useAtomValue(entry.canPublish)
  const reset = useSetAtom(node.reset)
  const selectedVersion = useAtomValue(entry.selectedVersion)
  const setSelectedVersion = useSetAtom(entry.selectedVersion)
  const saveDraft = useSetAtom(entry.saveDraft)
  const saveTranslation = useSetAtom(entry.saveTranslation)
  const publishEdits = useSetAtom(entry.publishEdits)
  const publishDraft = useSetAtom(entry.publishDraft)
  const mutationQueue = useAtomValue(mutationQueueAtom)
  const type = useAtomValue(entry.type)
  const access = policy.get(activeVersion)
  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState<Error>()
  const [urlConflict, setUrlConflict] = useState<EntryUrlConflictErrorInfo>()
  const isActionDisabled = isPending || mutationQueue.failed > 0
  const isRevision = selectedVersion.type === 'history'
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const mediaDraftsDisabled = isMediaFile || isMediaLibrary

  async function runAction(action: () => void | Promise<void>) {
    if (mutationQueue.failed > 0) return
    setIsPending(true)
    try {
      await action()
    } catch (cause) {
      const conflict = entryUrlConflictInfo(cause)
      if (conflict) {
        setUrlConflict(conflict)
        return
      }
      setActionError(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      setIsPending(false)
    }
  }

  if (actionError) throw actionError

  async function createDraftFromRevision() {
    await saveDraft(node)
    setSelectedVersion({type: 'status', status: 'draft'})
  }

  const saveDraftVisible =
    !mediaDraftsDisabled && config.enableDrafts && access.update
  const actionButtons =
    isRevision && saveDraftVisible ? (
      <Button
        icon={IcRoundSave}
        intent="primary"
        isDisabled={isActionDisabled}
        isPending={isPending}
        onPress={() => runAction(createDraftFromRevision)}
      >
        Create draft
      </Button>
    ) : isRevision ? null : untranslated &&
      !parentNeedsTranslation &&
      access.update ? (
      <Button
        icon={IcRoundSave}
        intent="primary"
        isDisabled={isActionDisabled}
        isPending={isPending}
        onPress={() => runAction(() => saveTranslation(node))}
      >
        Save translation
      </Button>
    ) : untranslated ? null : isDirty ? (
      <>
        <Button
          appearance="plain"
          isDisabled={isPending}
          onPress={() => reset()}
        >
          Discard my changes
        </Button>
        {access.publish && (
          <Button
            icon={IcRoundCheck}
            intent={saveDraftVisible ? 'secondary' : 'primary'}
            isDisabled={isActionDisabled}
            isPending={isPending}
            onPress={() => runAction(() => publishEdits(node))}
          >
            Publish
          </Button>
        )}
        {saveDraftVisible && (
          <Button
            icon={IcRoundSave}
            intent="primary"
            isDisabled={isActionDisabled}
            isPending={isPending}
            onPress={() => runAction(() => saveDraft(node))}
          >
            Save draft
          </Button>
        )}
      </>
    ) : activeStatus === 'draft' && canPublishParents && access.publish ? (
      <Button
        icon={IcRoundCheck}
        intent="primary"
        isDisabled={isActionDisabled}
        isPending={isPending}
        onPress={() => runAction(publishDraft)}
      >
        Publish
      </Button>
    ) : null

  return (
    <>
      <div className={styles.EntryHeader.actions()}>
        {actionButtons}
        {onSidebarOpenChange && !isSidebarOpen && (
          <EntrySidebarToggle
            isOpen={false}
            onOpenChange={onSidebarOpenChange}
          />
        )}
      </div>
      <UrlConflictModal
        conflict={urlConflict}
        onClose={() => setUrlConflict(undefined)}
      />
    </>
  )
}

export function EntryHeader({
  controls,
  entry,
  page,
  isSidebarOpen,
  node,
  onSidebarOpenChange
}: EntryHeaderProps) {
  const title = useAtomValue(entry.label)
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = page.activeVersion
  const selectedVersion = useAtomValue(entry.selectedVersion)
  const viewedEntry = page.currentEntry
  const untranslated = useAtomValue(entry.untranslated)
  const parentNeedsTranslation = page.parentNeedsTranslation
  const isDirty = useAtomValue(node.isDirty)
  const type = useAtomValue(entry.type)
  const typeSettings = getType(type)
  const isRevision = selectedVersion.type === 'history'
  const isUnpublished = Boolean(activeVersion?.main && activeStatus === 'draft')
  const viewedStatus = isRevision
    ? (viewedEntry?.status ?? activeStatus)
    : activeStatus
  const viewedIsUnpublished = Boolean(
    isRevision ? viewedEntry?.main && viewedStatus === 'draft' : isUnpublished
  )
  const status = viewedIsUnpublished ? 'unpublished' : viewedStatus
  return (
    <header className={styles.EntryHeader()}>
      <div className={styles.EntryHeader.content()}>
        <div className={styles.EntryHeader.main()}>
          <EntryHeaderBackButton entry={entry} />
          <h1 className={styles.EntryHeader.title()}>{title}</h1>
          {controls}
          <Badge icon={typeSettings.icon}>{typeSettings.label}</Badge>
          {isRevision ? (
            <Badge icon={IcRoundPublishedWithChanges}>Revision</Badge>
          ) : (
            <StatusBadge status={status} />
          )}
          <EntryHeaderMoreActions
            entry={entry}
            page={page}
            activeStatus={activeStatus}
            isDirty={isDirty}
            isUnpublished={isUnpublished}
            untranslated={untranslated}
          />
        </div>
        <EntryHeaderActions
          entry={entry}
          page={page}
          node={node}
          activeStatus={activeStatus}
          isDirty={isDirty}
          isUnpublished={isUnpublished}
          isSidebarOpen={isSidebarOpen}
          onSidebarOpenChange={onSidebarOpenChange}
          untranslated={untranslated}
          parentNeedsTranslation={parentNeedsTranslation}
        />
      </div>
    </header>
  )
}
