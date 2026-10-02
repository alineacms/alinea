import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  PageActions,
  PageBack,
  PageHeader,
  PageTitle,
  Text
} from '#/components.js'
import {
  EntryUrlConflictError,
  type EntryUrlConflictErrorInfo
} from '#/core/db/EntryUrlConflictError.js'
import {EntryValidationError} from '#/core/db/EntryValidationError.js'
import type {Entry} from '#/core/Entry.js'
import {getType} from '#/core/Internal.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import type {FieldValidationError} from '#/core/Validation.js'
import {activityAtom} from '../atoms/activity.js'
import {configAtom} from '../atoms/core.js'
import {
  archiveEntriesAtom,
  deleteEntriesAtom,
  loadDeletePlanAtom,
  type DeletePlan
} from '../atoms/delete.js'
import type {EntryAtoms, EntryLocaleAtoms} from '../atoms/entry.js'
import {loadMoveTargetsAtom, type MoveTargets} from '../atoms/move.js'
import {routeAtom} from '../atoms/nav.js'
import type {ReactiveNode} from '../atoms/ReactiveNode.js'
import {policyAtom} from '../atoms/user.js'
import {useSaveShortcut} from '../hook/UseSaveShortcut.js'
import {styler} from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom, useStore} from 'jotai'
import {
  type ComponentType,
  useState,
  useTransition,
  type ReactNode
} from 'react'
import {
  IcRoundArchive,
  IcRoundCheck,
  IcRoundDelete,
  IcRoundDriveFileMove,
  IcRoundMoreHoriz,
  IcRoundPublishedWithChanges,
  IcRoundSave,
  IcRoundSync,
  IcRoundVisibilityOff
} from '../icons.js'
import {DeleteDialog} from './DeleteDialog.js'
import css from './EntryHeader.module.css'
import {
  entryHeaderActions,
  entryHeaderPrimaryActions
} from './EntryHeaderActions.js'
import {EntrySidebarToggle} from './EntrySidebarToggle.js'
import {
  type EntryValidationFailure,
  EntryValidationModal
} from './EntryValidationModal.js'
import {MoveDialog} from './MoveDialog.js'
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
      open={Boolean(conflict)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {conflict && (
        <DashboardModalDialog label="URL already in use">
          <DashboardModalContent>
            <Text as="p">
              The URL <strong>{conflict.url}</strong> is already defined on
              entry <strong>{conflict.entryId}</strong> in workspace{' '}
              <strong>{conflict.workspace}</strong>, root{' '}
              <strong>{conflict.root}</strong>.
            </Text>
            <Text as="p">
              Change the entry path or remove this alias, then try again.
            </Text>
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

function entryValidationFailure(
  error: unknown
): EntryValidationFailure | undefined {
  if (error instanceof EntryValidationError)
    return {errors: error.info.errors, message: error.message}
  // Errors thrown in the shared worker arrive without their details
  if (!isRecord(error) || error.name !== 'EntryValidationError') return
  const info = error.info
  if (isRecord(info) && Array.isArray(info.errors))
    return {errors: info.errors as Array<FieldValidationError>}
  return {message: typeof error.message === 'string' ? error.message : ''}
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
  const store = useStore()
  const config = useAtomValueRaw(configAtom)
  const activity = useAtomValueRaw(activityAtom)
  const policy = useAtomValueRaw(policyAtom)
  const route = useAtomValueRaw(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  const versions = useAtomValueRaw(localeData.versions)
  const untranslated = useAtomValueRaw(localeData.untranslated)
  const typeName = useAtomValueRaw(entry.type)
  const hasChildren = useAtomValueRaw(entry.hasChildren)
  const locales = useAtomValueRaw(entry.translationSourceLocales)
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
  const loadDeletePlan = useSetAtom(loadDeletePlanAtom)
  const loadMoveTargets = useSetAtom(loadMoveTargetsAtom)
  const deleteEntries = useSetAtom(deleteEntriesAtom)
  const archiveEntries = useSetAtom(archiveEntriesAtom)
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
  const [invalid, setInvalid] = useState<EntryValidationFailure>()
  const [moving, setMoving] = useState<MoveTargets>()
  const [deletePlan, setDeletePlan] = useState<DeletePlan>()

  function runAction(action: () => void | Promise<void>) {
    startTransition(async () => {
      try {
        await action()
      } catch (error) {
        const conflict = entryUrlConflictInfo(error)
        const failure = entryValidationFailure(error)
        if (conflict) setUrlConflict(conflict)
        else if (failure) setInvalid(failure)
        else throw error
      }
    })
  }

  // Publishing requires valid fields, drafts are work in progress
  function runPublish(action: () => void | Promise<void>) {
    // Validated when publishing, not on every edit
    const errors = store.get(localeData.errors(node))
    if (errors.length > 0) setInvalid({errors})
    else runAction(action)
  }

  // The references load before the dialog opens, the menu shows it is busy
  async function openDeleteDialog() {
    assert(activeVersion)
    // No language is picked when the entry is not translated in the one shown
    const locale = untranslated
      ? localeData.requestedLocale
      : activeVersion.locale
    setDeletePlan(
      await loadDeletePlan([{...activeVersion, hasChildren, locale}], locales)
    )
  }

  async function deleteAndNavigate(plan: DeletePlan) {
    assert(activeVersion)
    const {locale} = activeVersion
    const selected = store.get(plan.selectedLocales)
    // Other languages remain when the one shown is not deleted, and the
    // untranslated view while the entry exists in another language
    const removed = untranslated
      ? locales.every(locale => selected.includes(locale))
      : locale === null || selected.includes(locale)
    if (removed)
      setRoute({
        workspace,
        root,
        entry: parentId ?? undefined,
        locale: route.locale
      })
    await deleteEntries(plan)
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
    const save = () => saveTranslation(node)
    if (config.enableDrafts) runAction(save)
    else runPublish(save)
  }

  function publishChanges() {
    runPublish(() => publishEdits(node))
  }

  function saveDraftChanges() {
    runAction(() => saveDraft(node))
  }

  function publishCurrentDraft() {
    runPublish(publishDraft)
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
    canMove: activeVersion.seeded === null && policy.canMove(activeVersion),
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
  if (actions.move)
    menuItems.push({
      id: 'move',
      label: 'Move to…',
      action: async () => setMoving(await loadMoveTargets([activeVersion])),
      icon: IcRoundDriveFileMove
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
      action: openDeleteDialog,
      icon: IcRoundDelete
    })

  return (
    <PageHeader size="lg" className={styles.EntryHeader({dirty: isDirty})}>
      <PageBack
        label={parentId ? 'Back to parent entry' : 'Back to root'}
        onClick={() =>
          setRoute({
            workspace,
            root,
            entry: parentId ?? undefined,
            locale: route.locale
          })
        }
      />
      <PageTitle>{selectedEntry.title}</PageTitle>
      {controls}
      {showStatus && (
        <Badge
          className={styles.EntryHeader.status()}
          icon={isRevision ? IcRoundPublishedWithChanges : undefined}
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
      <PageActions className={styles.EntryHeader.actions()}>
        {primaryAction}
        {onSidebarOpenChange && !isSidebarOpen && (
          <EntrySidebarToggle
            className={styles.EntryHeader.sidebarToggle()}
            isOpen={false}
            onOpenChange={onSidebarOpenChange}
          />
        )}
      </PageActions>
      <UrlConflictModal
        conflict={urlConflict}
        onClose={() => setUrlConflict(undefined)}
      />
      <EntryValidationModal
        failure={invalid}
        onClose={() => setInvalid(undefined)}
      />
      <MoveDialog targets={moving} onClose={() => setMoving(undefined)} />
      <DeleteDialog
        plan={deletePlan}
        onClose={() => setDeletePlan(undefined)}
        onConfirm={deleteAndNavigate}
        onArchive={archiveEntries}
      />
    </PageHeader>
  )
}
