import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {ComponentType, type ReactNode, useTransition} from 'react'
import {usePolicy} from '../hooks.js'
import {
  IcOutlineArchive,
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundFlashOn,
  IcRoundMoreHoriz,
  IcRoundSave,
  IcRoundSync,
  IcRoundVisibilityOff
} from '../icons.js'
import {DashboardEntryData, ReactiveNode} from '../store/Dashboard.js'
import {Badge} from './Badge.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'

const styles = styler(css)

export interface EntryHeaderProps {
  controls?: ReactNode
  entry: DashboardEntryData
  isSidebarOpen?: boolean
  node: ReactiveNode<object>
  onSidebarOpenChange?: (isOpen: boolean) => void
}

interface EntryHeaderActionProps {
  entry: DashboardEntryData
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
  entry: DashboardEntryData
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
  entry: DashboardEntryData
}

function EntryHeaderBackButton({entry}: EntryHeaderBackButtonProps) {
  const route = useAtomValue(entry.dashboard.route)
  const parentId = useAtomValue(entry.parentId)
  const workspace = useAtomValue(entry.workspaceKey)
  const root = useAtomValue(entry.rootKey)
  const setRoute = useSetAtom(entry.dashboard.route)
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
  activeStatus,
  isDirty,
  isUnpublished,
  untranslated
}: EntryHeaderMoreActionsProps) {
  const policy = usePolicy()
  const config = useAtomValue(entry.dashboard.config)
  const route = useAtomValue(entry.dashboard.route)
  const parentId = useAtomValue(entry.parentId)
  const workspace = useAtomValue(entry.workspaceKey)
  const root = useAtomValue(entry.rootKey)
  const sourceLocale = useAtomValue(entry.sourceLocale)
  const activeVersion = useAtomValue(
    entry.languages(sourceLocale).activeVersion
  )
  const type = useAtomValue(entry.type)
  const canPublishParents = useAtomValue(entry.canPublish)
  const isParentUnpublished = useAtomValue(entry.parentUnpublished)
  const selectedVersion = useAtomValue(entry.selectedVersion)
  const setRoute = useSetAtom(entry.dashboard.route)
  const discardDraft = useSetAtom(entry.discardDraft)
  const unpublish = useSetAtom(entry.unpublish)
  const archive = useSetAtom(entry.archive)
  const publishArchived = useSetAtom(entry.publishArchived)
  const deleteEntry = useSetAtom(entry.deleteEntry)
  const replaceFile = useSetAtom(entry.replaceFile)
  const mutationQueue = useAtomValue(entry.dashboard.mutationQueue)
  const access = policy.get(activeVersion)
  const canDelete = activeVersion.seeded === null
  const isMediaFile = type.type === MediaFile
  const isMediaLibrary = type.type === MediaLibrary
  const [isPending, startTransition] = useTransition()
  const isActionDisabled = isPending || mutationQueue.failed > 0
  const isRevision = selectedVersion.type === 'history'
  const menuItems: Array<EntryHeaderMenuItem> = []

  function runAction(action: () => void | Promise<void>) {
    if (mutationQueue.failed > 0) return
    startTransition(async () => {
      await action()
    })
  }

  async function deleteAndNavigate() {
    await deleteEntry()
    setRoute({
      workspace,
      root,
      entry: parentId ?? undefined,
      locale: route.locale
    })
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
  )
}

function EntryHeaderActions({
  entry,
  node,
  activeStatus,
  isDirty,
  isSidebarOpen,
  onSidebarOpenChange,
  untranslated,
  parentNeedsTranslation
}: EntryHeaderActionProps) {
  const policy = usePolicy()
  const config = useAtomValue(entry.dashboard.config)
  const sourceLocale = useAtomValue(entry.sourceLocale)
  const activeVersion = useAtomValue(
    entry.languages(sourceLocale).activeVersion
  )
  const canPublishParents = useAtomValue(entry.canPublish)
  const reset = useSetAtom(node.reset)
  const selectedVersion = useAtomValue(entry.selectedVersion)
  const setSelectedVersion = useSetAtom(entry.selectedVersion)
  const saveDraft = useSetAtom(entry.saveDraft)
  const saveTranslation = useSetAtom(entry.saveTranslation)
  const publishEdits = useSetAtom(entry.publishEdits)
  const publishDraft = useSetAtom(entry.publishDraft)
  const mutationQueue = useAtomValue(entry.dashboard.mutationQueue)
  const type = useAtomValue(entry.type)
  const access = policy.get(activeVersion)
  const [isPending, startTransition] = useTransition()
  const isActionDisabled = isPending || mutationQueue.failed > 0
  const isRevision = selectedVersion.type === 'history'
  const isMediaFile = type.type === MediaFile
  const isMediaLibrary = type.type === MediaLibrary
  const mediaDraftsDisabled = isMediaFile || isMediaLibrary

  function runAction(action: () => void | Promise<void>) {
    if (mutationQueue.failed > 0) return
    startTransition(async () => {
      await action()
    })
  }

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
    <div className={styles.EntryHeader.actions()}>
      {actionButtons}
      {onSidebarOpenChange && !isSidebarOpen && (
        <EntrySidebarToggle isOpen={false} onOpenChange={onSidebarOpenChange} />
      )}
    </div>
  )
}

const variantDescription = {
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Archived',
  draft: 'Draft'
}

const badgeStatus = {
  published: 'published',
  unpublished: 'unpublished',
  archived: 'archived',
  draft: 'draft'
} as const

const badgeIcon = {
  published: IcRoundCheck,
  unpublished: IcRoundFlashOn,
  archived: IcOutlineArchive,
  draft: IcRoundEdit
}

export function EntryHeader({
  controls,
  entry,
  isSidebarOpen,
  node,
  onSidebarOpenChange
}: EntryHeaderProps) {
  const title = useAtomValue(entry.label)
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = useAtomValue(entry.activeVersion)
  const viewedEntry = useAtomValue(entry.currentEntry)
  const untranslated = useAtomValue(entry.untranslated)
  const parentNeedsTranslation = useAtomValue(entry.parentNeedsTranslation)
  const isDirty = useAtomValue(node.isDirty)
  const isUnpublished = Boolean(activeVersion?.main && activeStatus === 'draft')
  const viewedStatus = viewedEntry?.status ?? activeStatus
  const viewedIsUnpublished = Boolean(
    viewedEntry?.main && viewedStatus === 'draft'
  )
  const status = viewedIsUnpublished ? 'unpublished' : viewedStatus
  const displayStatus = variantDescription[status]
  return (
    <header className={styles.EntryHeader()}>
      <div className={styles.EntryHeader.content()}>
        <div className={styles.EntryHeader.main()}>
          <EntryHeaderBackButton entry={entry} />
          <h1 className={styles.EntryHeader.title()}>{title}</h1>
          <Badge
            className={styles.EntryHeader.status()}
            icon={badgeIcon[status]}
            status={badgeStatus[status]}
          >
            {displayStatus}
          </Badge>
          {controls}
          <EntryHeaderMoreActions
            entry={entry}
            activeStatus={activeStatus}
            isDirty={isDirty}
            isUnpublished={isUnpublished}
            untranslated={untranslated}
          />
        </div>
        <EntryHeaderActions
          entry={entry}
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
