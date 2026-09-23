import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '#/components.js'
import {
  EntryUrlConflictError,
  type EntryUrlConflictErrorInfo
} from '#/core/db/EntryUrlConflictError.js'
import type {Entry} from '#/core/Entry.js'
import {getType} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {activityAtom} from '#/dashboard/atoms/activity.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import type {EntryAtoms, EntryLocaleAtoms} from '#/dashboard/atoms/entry.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import type {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import {useSaveShortcut} from '#/dashboard/hook/UseSaveShortcut.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {ComponentType, useState, useTransition, type ReactNode} from 'react'
import {
  IcOutlineArchive,
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundEdit,
  IcRoundFlashOn,
  IcRoundLanguage,
  IcRoundMoreHoriz,
  IcRoundPublishedWithChanges,
  IcRoundSave,
  IcRoundSync,
  IcRoundVisibilityOff
} from '../icons.js'
import {Badge} from './Badge.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'
import {
  entryHeaderActions,
  entryHeaderPrimaryActions
} from './EntryHeaderActions.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {ReadOnlyBadge} from './ReadOnlyBadge.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

interface EntryHeaderMenuItem {
  id: string
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
        <DashboardModalDialog label="URL already in use">
          <DashboardModalContent>
            <p>
              The URL <strong>{conflict.url}</strong> is already defined on
              entry <strong>{conflict.entryId}</strong> in workspace{' '}
              <strong>{conflict.workspace}</strong>, root{' '}
              <strong>{conflict.root}</strong>.
            </p>
            <p>Change the entry path or remove this alias, then try again.</p>
          </DashboardModalContent>
          <DashboardModalFooter>
            <Button color="primary" onClick={onClose}>
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
  draft: 'Draft',
  untranslated: 'Untranslated'
}

const badgeStatus = {
  published: 'published',
  unpublished: 'unpublished',
  archived: 'archived',
  draft: 'draft',
  untranslated: 'untranslated'
} as const

const badgeIcon = {
  published: IcRoundCheck,
  unpublished: IcRoundFlashOn,
  archived: IcOutlineArchive,
  draft: IcRoundEdit,
  untranslated: IcRoundLanguage
}

export interface EntryHeaderProps {
  controls?: ReactNode
  entry: EntryAtoms
  localeData: EntryLocaleAtoms
  isSidebarOpen?: boolean
  node: ReactiveNode<object>
  onSidebarOpenChange?: (isOpen: boolean) => void
  parentNeedsTranslation: boolean
  selectedEntry: Entry
}

export function EntryHeader({
  controls,
  entry,
  localeData,
  isSidebarOpen,
  node,
  onSidebarOpenChange,
  parentNeedsTranslation,
  selectedEntry
}: EntryHeaderProps) {
  const config = useAtomValueRaw(configAtom)
  const activity = useAtomValueRaw(activityAtom)
  const policy = useAtomValueRaw(policyAtom)
  const route = useAtomValueRaw(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  const versions = useAtomValueRaw(localeData.versions)
  const untranslated = useAtomValueRaw(localeData.untranslated)
  const typeName = useAtomValueRaw(entry.type)
  const parentId = useAtomValueRaw(entry.parentId)
  const workspace = useAtomValueRaw(entry.workspace)
  const root = useAtomValueRaw(entry.root)
  const canPublishParents = useAtomValueRaw(entry.canPublishParents)
  const isParentUnpublished = useAtomValueRaw(entry.parentUnpublished)
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
  const isDirty = useAtomValueRaw(node.isDirty)
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
  const status = untranslated
    ? 'untranslated'
    : viewedStatus === 'draft' && selectedEntry.main
      ? 'unpublished'
      : viewedStatus
  const showStatus = isRevision || status !== 'published'
  const [isPending, startTransition] = useTransition()
  const isActionDisabled = isPending || activity.isMutating
  const [urlConflict, setUrlConflict] = useState<EntryUrlConflictErrorInfo>()

  function runAction(action: () => void | Promise<void>) {
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
    setRoute({
      workspace,
      root,
      entry: parentId ?? undefined,
      locale: route.locale
    })
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    await deleteEntry()
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
  const primaryActions = entryHeaderPrimaryActions({
    access,
    activeStatus,
    canPublishParents,
    canSaveDraft: Boolean(canSaveDraft),
    isDirty,
    isRevision,
    parentNeedsTranslation,
    untranslated
  })

  function createDraft() {
    runAction(async () => {
      await saveDraft(node)
      setSelectedVersion({type: 'status', status: 'draft'})
    })
  }

  function saveTranslationChanges() {
    runAction(() => saveTranslation(node))
  }

  function publishChanges() {
    runAction(() => publishEdits(node))
  }

  function saveDraftChanges() {
    runAction(() => saveDraft(node))
  }

  function publishCurrentDraft() {
    runAction(publishDraft)
  }

  let saveShortcut: (() => void) | undefined
  if (primaryActions.dirty?.saveDraft) saveShortcut = saveDraftChanges
  else if (primaryActions.dirty?.publish) saveShortcut = publishChanges
  else if (primaryActions.saveTranslation) saveShortcut = saveTranslationChanges
  else if (primaryActions.createDraft) saveShortcut = createDraft
  else if (primaryActions.publishDraft) saveShortcut = publishCurrentDraft
  useSaveShortcut(saveShortcut, isActionDisabled)

  let primaryAction: ReactNode = null
  if (primaryActions.createDraft) {
    primaryAction = (
      <Button
        icon={IcRoundSave}
        color="primary"
        disabled={isActionDisabled}
        loading={isPending}
        onClick={createDraft}
      >
        Create draft
      </Button>
    )
  } else if (primaryActions.saveTranslation) {
    primaryAction = (
      <Button
        icon={IcRoundSave}
        color="primary"
        disabled={isActionDisabled}
        loading={isPending}
        onClick={saveTranslationChanges}
      >
        Save translation
      </Button>
    )
  } else if (primaryActions.dirty) {
    primaryAction = (
      <>
        <Button variant="ghost" disabled={isPending} onClick={() => reset()}>
          Discard my changes
        </Button>
        {primaryActions.dirty.publish && (
          <Button
            icon={IcRoundCheck}
            color={canSaveDraft ? 'secondary' : 'primary'}
            disabled={isActionDisabled}
            loading={isPending}
            onClick={publishChanges}
          >
            Publish
          </Button>
        )}
        {primaryActions.dirty.saveDraft && (
          <Button
            icon={IcRoundSave}
            color="primary"
            disabled={isActionDisabled}
            loading={isPending}
            onClick={saveDraftChanges}
          >
            Save draft
          </Button>
        )}
      </>
    )
  } else if (primaryActions.publishDraft) {
    primaryAction = (
      <Button
        icon={IcRoundCheck}
        color="primary"
        disabled={isActionDisabled}
        loading={isPending}
        onClick={publishCurrentDraft}
      >
        Publish
      </Button>
    )
  }

  const menuItems: Array<EntryHeaderMenuItem> = []
  const actions = entryHeaderActions({
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
  if (actions.removeDraft)
    menuItems.push({
      id: 'remove-draft',
      label: 'Remove draft',
      action: discardDraft,
      icon: IcRoundDelete
    })
  if (actions.replace)
    menuItems.push({
      id: 'replace',
      label: 'Replace',
      action: replaceMediaFile,
      icon: IcRoundSync
    })
  if (actions.unpublish)
    menuItems.push({
      id: 'unpublish',
      label: 'Unpublish',
      action: unpublish,
      icon: IcRoundVisibilityOff
    })
  if (actions.archive)
    menuItems.push({
      id: 'archive',
      label: 'Archive',
      action: archive,
      icon: IcRoundArchive
    })
  if (actions.publish)
    menuItems.push({
      id: 'publish',
      label: 'Publish',
      action: publishArchived,
      icon: IcRoundCheck
    })
  if (actions.delete)
    menuItems.push({
      id: 'delete',
      label: 'Delete',
      action: deleteAndNavigate,
      icon: IcRoundDelete
    })

  return (
    <header className={styles.EntryHeader({dirty: isDirty})}>
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
          {controls}
          {showStatus && (
            <Badge
              className={styles.EntryHeader.status()}
              icon={
                isRevision ? IcRoundPublishedWithChanges : badgeIcon[status]
              }
              status={isRevision ? undefined : badgeStatus[status]}
            >
              {isRevision ? 'Revision' : variantDescription[status]}
            </Badge>
          )}
          <Badge className={styles.EntryHeader.type()} icon={typeData.icon}>
            {typeData.label}
          </Badge>
          {!access.update && <ReadOnlyBadge />}
          {menuItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                size="icon"
                variant="ghost"
                aria-label="More actions"
                icon={IcRoundMoreHoriz}
                disabled={isActionDisabled}
                loading={isPending}
              />
              <DropdownMenuContent
                aria-label="More actions"
                side="bottom"
                align="start"
              >
                {menuItems.map(item => (
                  <DropdownMenuItem
                    key={item.id}
                    icon={item.icon}
                    textValue={item.label}
                    disabled={isActionDisabled}
                    onSelect={() => runAction(item.action)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className={styles.EntryHeader.actions()}>
          {primaryAction}
          {onSidebarOpenChange && !isSidebarOpen && (
            <EntrySidebarToggle
              className={styles.EntryHeader.sidebarToggle()}
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
