import {Button, Icon, Menu, MenuItem} from '#/components.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {
  IcOutlineArchive,
  IcOutlineRemoveRedEye,
  IcRoundCheck,
  IcRoundEdit,
  IcRoundFlashOn,
  IcRoundMoreVert,
  IcRoundSave,
  IcRoundTranslate
} from '../icons.js'
import {DashboardEntry, ReactiveNode} from '../store/Dashboard.js'
import {Badge} from './Badge.js'
import {EditorBackButton} from './EditorBackButton.js'
import css from './EntryHeader.module.css'
import {RailHeader} from './ui/Rail.js'

const styles = styler(css)

export interface EntryHeaderProps {
  entry: DashboardEntry
  node: ReactiveNode<object>
}

function entryStatus(
  untranslated: boolean,
  isDirty: boolean,
  activeStatus: 'draft' | 'published' | 'archived',
  isUnpublished: boolean
) {
  if (untranslated)
    return {
      label: 'Untranslated',
      icon: IcRoundTranslate
    }
  if (isDirty)
    return {
      label: 'Editing',
      icon: IcRoundEdit
    }
  if (isUnpublished)
    return {
      label: 'Unpublished',
      icon: IcRoundFlashOn
    }
  switch (activeStatus) {
    case 'published':
      return {
        label: 'Published',
        icon: IcOutlineRemoveRedEye
      }
    case 'archived':
      return {
        label: 'Archived',
        icon: IcOutlineArchive
      }
    default:
      return {
        label: 'Draft',
        icon: IcRoundEdit
      }
  }
}

interface EntryHeaderActionProps {
  entry: DashboardEntry
  node: ReactiveNode<object>
  activeStatus: 'draft' | 'published' | 'archived'
  isDirty: boolean
  isUnpublished: boolean
  untranslated: boolean
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
  untranslated
}: EntryHeaderActionProps) {
  const reset = useSetAtom(node.reset)
  const saveDraft = useSetAtom(entry.saveDraft)
  const publishEdits = useSetAtom(entry.publishEdits)
  const publishDraft = useSetAtom(entry.publishDraft)
  const discardDraft = useSetAtom(entry.discardDraft)
  const unpublish = useSetAtom(entry.unpublish)
  const archive = useSetAtom(entry.archive)
  const publishArchived = useSetAtom(entry.publishArchived)

  const primaryButton = untranslated ? null : isDirty ? (
    <>
      <Button intent="secondary" onPress={() => reset()}>
        Discard my changes
      </Button>
      <Button icon={IcRoundCheck} onPress={() => publishEdits(node)}>
        Publish
      </Button>
      <Button icon={IcRoundSave} onPress={() => saveDraft(node)}>
        Save draft
      </Button>
    </>
  ) : activeStatus === 'draft' ? (
    <Button icon={IcRoundCheck} onPress={() => publishDraft()}>
      Publish
    </Button>
  ) : activeStatus === 'archived' ? (
    <Button icon={IcRoundCheck} onPress={() => publishArchived()}>
      Publish
    </Button>
  ) : null

  const menuItems =
    activeStatus === 'draft'
      ? isUnpublished
        ? [
            {
              id: 'discard-draft',
              label: 'Discard draft',
              action: discardDraft
            },
            {
              id: 'archive',
              label: 'Archive',
              action: archive
            }
          ]
        : [
            {
              id: 'discard-draft',
              label: 'Discard draft',
              action: discardDraft
            }
          ]
      : !isDirty && activeStatus === 'published'
        ? [
            {
              id: 'unpublish',
              label: 'Unpublish',
              action: unpublish
            },
            {
              id: 'archive',
              label: 'Archive',
              action: archive
            }
          ]
        : []

  return (
    <div className={styles.EntryHeader.actions()}>
      {primaryButton}
      {menuItems.length > 0 && (
        <Menu
          label={
            <Button
              size="icon"
              appearance="plain"
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
              onAction={() => item.action()}
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
  const isDirty = useAtomValue(node.isDirty)
  const isUnpublished = Boolean(activeVersion?.main && activeStatus === 'draft')
  const status = entryStatus(untranslated, isDirty, activeStatus, isUnpublished)
  return (
    <RailHeader className={styles.EntryHeader()}>
      <div className={styles.EntryHeader.main()}>
        <EntryHeaderBackButton entry={entry} />
        <h1 className={styles.EntryHeader.title()}>{title}</h1>
        <Badge
          className={styles.EntryHeader.badge()}
          icon={status.icon}
          appearance="plain"
        >
          {status.label}
        </Badge>
      </div>
      <EntryHeaderActions
        entry={entry}
        node={node}
        activeStatus={activeStatus}
        isDirty={isDirty}
        isUnpublished={isUnpublished}
        untranslated={untranslated}
      />
    </RailHeader>
  )
}
