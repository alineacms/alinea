import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {IcRoundCheck, IcRoundMoreVert, IcRoundSave} from '../icons.js'
import {DashboardEntry, ReactiveNode} from '../store/Dashboard.js'
import {usePolicy} from '../store/hooks.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface EntryHeaderProps {
  entry: DashboardEntry
  node: ReactiveNode<object>
}

interface EntryHeaderActionProps {
  entry: DashboardEntry
  node: ReactiveNode<object>
  activeStatus: 'draft' | 'published' | 'archived'
  isDirty: boolean
  isUnpublished: boolean
  untranslated: boolean
  parentNeedsTranslation: boolean
}

interface EntryHeaderMenuItem {
  id: string
  label: string
  action: () => void | Promise<void>
}

interface EntryHeaderBackButtonProps {
  entry: DashboardEntry
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
  const access = policy.get(activeVersion)
  const canDelete = activeVersion.seeded === null
  const isMediaFile = type.type === MediaFile

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
      if (file) replaceFile(file)
    }
    input.click()
  }

  const saveDraftVisible = config.enableDrafts && access.update
  const actionButtons =
    untranslated && !parentNeedsTranslation && access.update ? (
      <Button
        icon={IcRoundSave}
        intent="primary"
        onPress={() => saveTranslation(node)}
      >
        Save translation
      </Button>
    ) : untranslated ? null : isDirty ? (
      <>
        <Button appearance="plain" onPress={() => reset()}>
          Discard my changes
        </Button>
        {access.publish && (
          <Button
            icon={IcRoundCheck}
            intent={saveDraftVisible ? 'secondary' : 'primary'}
            onPress={() => publishEdits(node)}
          >
            Publish
          </Button>
        )}
        {saveDraftVisible && (
          <Button
            icon={IcRoundSave}
            intent="primary"
            onPress={() => saveDraft(node)}
          >
            Save draft
          </Button>
        )}
      </>
    ) : activeStatus === 'draft' && canPublishParents && access.publish ? (
      <Button
        icon={IcRoundCheck}
        intent="primary"
        onPress={() => publishDraft()}
      >
        Publish
      </Button>
    ) : null

  const menuItems: Array<EntryHeaderMenuItem> = []

  if (!isDirty && !untranslated) {
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
            >
              <Icon icon={IcRoundMoreVert} />
            </Button>
          }
          aria-label="More actions"
        >
          {menuItems.map(item => (
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              onAction={() => {
                void item.action()
              }}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  )
}

export function EntryHeader({entry, node}: EntryHeaderProps) {
  const title = useAtomValue(entry.label)
  const activeStatus = useAtomValue(entry.activeStatus)
  const activeVersion = useAtomValue(entry.activeVersion)
  const untranslated = useAtomValue(entry.untranslated)
  const parentNeedsTranslation = useAtomValue(entry.parentNeedsTranslation)
  const isDirty = useAtomValue(node.isDirty)
  const isUnpublished = Boolean(activeVersion?.main && activeStatus === 'draft')
  return (
    <RailHeader className={styles.EntryHeader()}>
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
        untranslated={untranslated}
        parentNeedsTranslation={parentNeedsTranslation}
      />
    </RailHeader>
  )
}
