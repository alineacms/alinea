import {Button, Menu, MenuItem, ToggleButton} from '#/components.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {useTransition} from 'react'
import {usePolicy} from '../hooks.js'
import {
  IcRoundCheck,
  IcRoundMoreVert,
  IcRoundSave,
  MaterialSymbolsRightPanelOpenRounded
} from '../icons.js'
import {DashboardEntryData, ReactiveNode} from '../store/Dashboard.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'

const styles = styler(css)

export interface EntryHeaderProps {
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

interface EntryHeaderMenuItem {
  id: string
  label: string
  action: () => void | Promise<void>
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

function EntryHeaderActions({
  entry,
  node,
  activeStatus,
  isDirty,
  isUnpublished,
  isSidebarOpen,
  onSidebarOpenChange,
  untranslated,
  parentNeedsTranslation
}: EntryHeaderActionProps) {
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
  const reset = useSetAtom(node.reset)
  const selectedVersion = useAtomValue(entry.selectedVersion)
  const setSelectedVersion = useSetAtom(entry.selectedVersion)
  const setRoute = useSetAtom(entry.dashboard.route)
  const saveDraft = useSetAtom(entry.saveDraft)
  const saveTranslation = useSetAtom(entry.saveTranslation)
  const publishEdits = useSetAtom(entry.publishEdits)
  const publishDraft = useSetAtom(entry.publishDraft)
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
  const [isPending, startTransition] = useTransition()
  const isActionDisabled = isPending || mutationQueue.failed > 0
  const isRevision = selectedVersion.type === 'history'

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

  async function createDraftFromRevision() {
    await saveDraft(node)
    setSelectedVersion({type: 'status', status: 'draft'})
  }

  const saveDraftVisible = config.enableDrafts && access.update
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

  const menuItems: Array<EntryHeaderMenuItem> = []

  if (!isRevision && !isDirty && !untranslated) {
    if (activeStatus === 'draft') {
      if (isUnpublished) {
        if (isParentUnpublished && canDelete && access.delete) {
          menuItems.push({
            id: 'delete',
            label: 'Delete',
            action: deleteAndNavigate
          })
        }
        if (!isParentUnpublished && access.archive) {
          menuItems.push({
            id: 'archive',
            label: 'Archive',
            action: archive
          })
        }
      } else if (access.update) {
        menuItems.push({
          id: 'remove-draft',
          label: 'Remove draft',
          action: discardDraft
        })
      }
    }

    if (activeStatus === 'published') {
      if (isMediaFile) {
        if (access.update && access.upload) {
          menuItems.push({
            id: 'replace',
            label: 'Replace',
            action: replaceMediaFile
          })
        }
        if (canDelete && access.delete) {
          menuItems.push({
            id: 'delete',
            label: 'Delete',
            action: deleteAndNavigate
          })
        }
      } else {
        if (config.enableDrafts && access.publish) {
          menuItems.push({
            id: 'unpublish',
            label: 'Unpublish',
            action: unpublish
          })
        }
        if (canDelete && access.archive) {
          menuItems.push({
            id: 'archive',
            label: 'Archive',
            action: archive
          })
        }
      }
    }

    if (activeStatus === 'archived') {
      if (canPublishParents && access.publish) {
        menuItems.push({
          id: 'publish',
          label: 'Publish',
          action: publishArchived
        })
      }
      if (canDelete && access.delete) {
        menuItems.push({
          id: 'delete',
          label: 'Delete',
          action: deleteAndNavigate
        })
      }
    }
  }

  return (
    <div className={styles.EntryHeader.actions()}>
      {actionButtons}
      {menuItems.length > 0 && (
        <Menu
          label={
            <Button
              size="icon"
              appearance="outline"
              intent="secondary"
              aria-label="More actions"
              icon={IcRoundMoreVert}
              isDisabled={isActionDisabled}
              isPending={isPending}
            />
          }
          aria-label="More actions"
          popoverProps={{placement: 'bottom end'}}
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
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      )}
      {onSidebarOpenChange && (
        <ToggleButton
          isSelected={isSidebarOpen}
          aria-label={
            isSidebarOpen ? 'Close entry sidebar' : 'Open entry sidebar'
          }
          onChange={onSidebarOpenChange}
        >
          <MaterialSymbolsRightPanelOpenRounded data-slot="icon" />
        </ToggleButton>
      )}
    </div>
  )
}

export function EntryHeader({
  entry,
  isSidebarOpen,
  node,
  onSidebarOpenChange
}: EntryHeaderProps) {
  const title = useAtomValue(entry.label)
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = useAtomValue(entry.activeVersion)
  const untranslated = useAtomValue(entry.untranslated)
  const parentNeedsTranslation = useAtomValue(entry.parentNeedsTranslation)
  const isDirty = useAtomValue(node.isDirty)
  const isUnpublished = Boolean(activeVersion?.main && activeStatus === 'draft')
  return (
    <header className={styles.EntryHeader()}>
      <div className={styles.EntryHeader.main()}>
        <EntryHeaderBackButton entry={entry} />
        <h1 className={styles.EntryHeader.title()}>{title}</h1>
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
    </header>
  )
}
