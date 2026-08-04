import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {getType} from '#/core/Internal.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {
  EntryUrlConflictError,
  type EntryUrlConflictErrorInfo
} from '#/core/db/EntryUrlConflictError.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {dashboardAtoms} from '#/dashboard/atoms/dashboard.js'
import type {EntryAtoms, EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValue, useSetAtom} from 'jotai'
import {ComponentType, type ReactNode, useState, useTransition} from 'react'
import {
  IcOutlineArchive,
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundFlashOn,
  IcRoundPublishedWithChanges,
  IcRoundMoreHoriz,
  IcRoundSave,
  IcRoundSync,
  IcRoundVisibilityOff
} from '../icons.js'
import {Badge} from './Badge.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'
import {
  entryHeaderActionIds,
  entryHeaderPrimaryActionIds,
  type EntryHeaderActionId
} from './EntryHeaderActions.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

interface EntryHeaderMenuItem {
  id: EntryHeaderActionId
  label: string
  action: () => void | Promise<void>
  icon?: ComponentType
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

export interface EntryHeaderProps {
  controls?: ReactNode
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  isSidebarOpen?: boolean
  node: ReactiveNode<object>
  onSidebarOpenChange?: (isOpen: boolean) => void
}

export function EntryHeader({
  controls,
  entry,
  localeData,
  isSidebarOpen,
  node,
  onSidebarOpenChange
}: EntryHeaderProps) {
  const config = useAtomValue(configAtom)
  const policy = entry.policy
  const route = useAtomValue(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  const selectedEntry = useAtomValue(localeData.selectedEntry)
  const versions = useAtomValue(localeData.versions)
  const untranslated = useAtomValue(localeData.untranslated)
  const parentNeedsTranslation = useAtomValue(localeData.parentNeedsTranslation)
  const typeName = useAtomValue(entry.type)
  const parentId = useAtomValue(entry.parentId)
  const workspace = useAtomValue(entry.workspace)
  const root = useAtomValue(entry.root)
  const canPublishParents = useAtomValue(entry.canPublishParents)
  const isParentUnpublished = useAtomValue(entry.parentUnpublished)
  const [selectedVersion, setSelectedVersion] = useAtom(
    localeData.selectedVersion
  )
  const saveDraft = useSetAtom(localeData.saveDraft)
  const saveTranslation = useSetAtom(localeData.saveTranslation)
  const publishEdits = useSetAtom(localeData.publishEdits)
  const publishDraft = useSetAtom(localeData.publishDraft)
  const discardDraft = useSetAtom(localeData.discardDraft)
  const unpublish = useSetAtom(localeData.unpublish)
  const archive = useSetAtom(localeData.archive)
  const publishArchived = useSetAtom(localeData.publishArchived)
  const deleteEntry = useSetAtom(localeData.deleteEntry)
  const replaceFile = useSetAtom(localeData.replaceFile)
  const reset = useSetAtom(node.reset)
  const isDirty = useAtomValue(node.isDirty)
  const mutationQueue = useAtomValue(dashboardAtoms.mutationQueue)
  const activeVersion = Array.from(versions.values()).find(
    version => version.active
  )
  assert(activeVersion, `Entry "${entry.id}" has no active version`)
  const activeStatus = activeVersion.status
  const access = policy.get(activeVersion)
  const type = config.schema[typeName]
  assert(type, `Type "${typeName}" not found in config`)
  const isMediaFile = type === MediaFile
  const isMediaLibrary = type === MediaLibrary
  const isMedia = isMediaFile || isMediaLibrary
  const typeData = getType(type)
  const isRevision = selectedVersion?.type === 'history'
  const isUnpublished = activeStatus === 'draft' && activeVersion.main
  const viewedStatus = selectedEntry.status
  const status =
    viewedStatus === 'draft' && selectedEntry.main
      ? 'unpublished'
      : viewedStatus
  const [isPending, startTransition] = useTransition()
  const isActionDisabled = isPending || mutationQueue.failed > 0
  const [urlConflict, setUrlConflict] = useState<EntryUrlConflictErrorInfo>()

  function runAction(action: () => void | Promise<void>) {
    if (mutationQueue.failed > 0) return
    startTransition(async () => {
      try {
        await action()
      } catch (error) {
        const conflict = entryUrlConflictInfo(error)
        if (conflict) setUrlConflict(conflict)
        else throw error
      }
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
    const extension = activeVersion?.data.extension
    if (typeof extension === 'string') input.accept = extension
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) runAction(() => replaceFile(file))
    }
    input.click()
  }

  const canSaveDraft = !isMedia && config.enableDrafts && access.update
  const primaryActionIds = entryHeaderPrimaryActionIds({
    access,
    activeStatus,
    canPublishParents,
    canSaveDraft: Boolean(canSaveDraft),
    isDirty,
    isRevision,
    parentNeedsTranslation,
    untranslated
  })
  let primaryAction: ReactNode = null
  if (primaryActionIds.includes('create-draft')) {
    primaryAction = (
      <Button
        icon={IcRoundSave}
        intent="primary"
        isDisabled={isActionDisabled}
        isPending={isPending}
        onPress={() =>
          runAction(async () => {
            await saveDraft(node)
            setSelectedVersion({type: 'status', status: 'draft'})
          })
        }
      >
        Create draft
      </Button>
    )
  } else if (primaryActionIds.includes('save-translation')) {
    primaryAction = (
      <Button
        icon={IcRoundSave}
        intent="primary"
        isDisabled={isActionDisabled}
        isPending={isPending}
        onPress={() => runAction(() => saveTranslation(node))}
      >
        Save translation
      </Button>
    )
  } else if (primaryActionIds.includes('discard-changes')) {
    primaryAction = (
      <>
        <Button
          appearance="plain"
          isDisabled={isPending}
          onPress={() => reset()}
        >
          Discard my changes
        </Button>
        {primaryActionIds.includes('publish-edits') && (
          <Button
            icon={IcRoundCheck}
            intent={canSaveDraft ? 'secondary' : 'primary'}
            isDisabled={isActionDisabled}
            isPending={isPending}
            onPress={() => runAction(() => publishEdits(node))}
          >
            Publish
          </Button>
        )}
        {primaryActionIds.includes('save-draft') && (
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
    )
  } else if (primaryActionIds.includes('publish-draft')) {
    primaryAction = (
      <Button
        icon={IcRoundCheck}
        intent="primary"
        isDisabled={isActionDisabled}
        isPending={isPending}
        onPress={() => runAction(publishDraft)}
      >
        Publish
      </Button>
    )
  }

  const menuItems: Array<EntryHeaderMenuItem> = []
  const actionIds = entryHeaderActionIds({
    access,
    activeStatus,
    canDelete: activeVersion.seeded === null,
    canPublishParents,
    draftsEnabled: Boolean(config.enableDrafts),
    isDirty,
    isMediaFile,
    isMediaLibrary,
    isParentUnpublished,
    isRevision,
    isUnpublished,
    untranslated
  })
  for (const actionId of actionIds) {
    if (actionId === 'remove-draft') {
      menuItems.push({
        id: 'remove-draft',
        label: 'Remove draft',
        action: discardDraft,
        icon: IcRoundDelete
      })
    } else if (actionId === 'replace') {
      menuItems.push({
        id: 'replace',
        label: 'Replace',
        action: replaceMediaFile,
        icon: IcRoundSync
      })
    } else if (actionId === 'unpublish') {
      menuItems.push({
        id: 'unpublish',
        label: 'Unpublish',
        action: unpublish,
        icon: IcRoundVisibilityOff
      })
    } else if (actionId === 'archive') {
      menuItems.push({
        id: 'archive',
        label: 'Archive',
        action: archive,
        icon: IcRoundArchive
      })
    } else if (actionId === 'publish') {
      menuItems.push({
        id: 'publish',
        label: 'Publish',
        action: publishArchived,
        icon: IcRoundCheck
      })
    } else {
      menuItems.push({
        id: 'delete',
        label: 'Delete',
        action: deleteAndNavigate,
        icon: IcRoundDelete
      })
    }
  }

  return (
    <header className={styles.EntryHeader()}>
      <div className={styles.EntryHeader.content()}>
        <div className={styles.EntryHeader.main()}>
          <EditorBackButton
            label={parentId ? 'Back to parent entry' : 'Back to root'}
            onPress={() =>
              setRoute({
                workspace,
                root,
                entry: parentId ?? undefined,
                locale: route.locale
              })
            }
          />
          <h1 className={styles.EntryHeader.title()}>{selectedEntry.title}</h1>
          <Badge
            className={styles.EntryHeader.status()}
            icon={isRevision ? IcRoundPublishedWithChanges : badgeIcon[status]}
            status={isRevision ? undefined : badgeStatus[status]}
          >
            {isRevision ? 'Revision' : variantDescription[status]}
          </Badge>
          <Badge icon={typeData.icon}>{typeData.label}</Badge>
          {controls}
          {menuItems.length > 0 && (
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
                  onAction={() => runAction(item.action)}
                >
                  {item.icon && <Icon icon={item.icon} />}
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          )}
        </div>
        <div className={styles.EntryHeader.actions()}>
          {primaryAction}
          {onSidebarOpenChange && !isSidebarOpen && (
            <EntrySidebarToggle
              isOpen={false}
              onOpenChange={onSidebarOpenChange}
            />
          )}
        </div>
      </div>
      <UrlConflictModal
        conflict={urlConflict}
        onClose={() => setUrlConflict(undefined)}
      />
    </header>
  )
}
