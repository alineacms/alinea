import {
  ContentCard,
  type ContentCardProps,
  ContentGrid,
  ContentGridItem,
  type DragDropProps
} from '#/components.js'
import {getWorkspace} from '#/core/Internal.js'
import {isImage} from '#/core/media/IsImage.js'
import type {MediaFile} from '#/core/media/MediaTypes.js'
import type {Infer} from '#/types.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import prettyBytes from 'pretty-bytes'
import type {ReactNode} from 'react'
import {memo, startTransition} from 'react'
import {configAtom} from '../atoms/core.js'
import type {
  DashboardEntry,
  DashboardEntryData,
  DashboardExplorer,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {IcTwotoneDescription, IcTwotoneFolder} from '../icons.js'
import {fileKindVisual} from './FileKind.js'
import css from './ExplorerCards.module.css'

const styles = styler(css)

interface ExplorerCardItemProps {
  breadcrumbs: boolean
  entry: DashboardEntry
  explorer: DashboardExplorer
  locale: string | null
  includeWorkspace: boolean
  onPick?: (entry: DashboardEntry) => void
}

const ExplorerCardItem = memo(function ExplorerCardItem({
  breadcrumbs,
  entry,
  explorer,
  locale,
  includeWorkspace,
  onPick
}: ExplorerCardItemProps) {
  const {data} = useAtomValueRaw(entry.data)
  const isSelectable = useAtomValueRaw(explorer.isSelectable(entry))
  const label = useAtomValueRaw(data.label)
  const icon = useAtomValueRaw(data.icon)
  const type = useAtomValueRaw(data.type)
  const canOpen = useAtomValueRaw(data.canOpen)
  const hasChildren = useAtomValueRaw(data.hasChildren)
  const performAction = useSetAtom(explorer.onAction)
  const hasAction = explorer.hasRowAction || (!isSelectable && canOpen)
  function onAction() {
    startTransition(() => performAction(entry, locale))
  }
  const file = useAtomValueRaw(data.fileInfo)
  const thumbnail = useAtomValueRaw(data.thumbnail)
  const card: ContentCardProps = file
    ? {
        variant: 'media',
        ...(file.preview && file.extension && isImage(file.extension)
          ? {image: file.preview, color: file.averageColor}
          : fileKindVisual(file.extension)),
        title: label,
        description: formatExtension(file.extension),
        details: formatFileDetails(file)
      }
    : thumbnail
      ? {
          variant: 'media',
          image: thumbnail.preview,
          color: thumbnail.averageColor,
          title: label,
          description: type.label
        }
      : {
          // Like the tree and table, only entries with children are folders
          icon: icon ?? (hasChildren ? IcTwotoneFolder : IcTwotoneDescription),
          title: label,
          description: type.label
        }
  return (
    <ContentGridItem
      id={entry.id}
      textValue={label}
      selectable={isSelectable}
      onAction={hasAction ? onAction : undefined}
      onClick={isSelectable && onPick ? () => onPick(entry) : undefined}
    >
      {breadcrumbs ? (
        <ExplorerLocatedCard
          {...card}
          data={data}
          entry={entry}
          includeWorkspace={includeWorkspace}
        />
      ) : (
        <ContentCard {...card} />
      )}
    </ContentGridItem>
  )
})

interface ExplorerLocatedCardProps extends ContentCardProps {
  data: DashboardEntryData
  entry: DashboardEntry
  includeWorkspace: boolean
}

/** A card with the location of its entry as breadcrumbs */
function ExplorerLocatedCard({
  data,
  entry,
  includeWorkspace,
  ...card
}: ExplorerLocatedCardProps) {
  const config = useAtomValueRaw(configAtom)
  const parents = useAtomValueRaw(data.parents)
  const root = useAtomValueRaw(data.root)
  const rootLabel = useAtomValueRaw(root.label)
  const workspace = config.workspaces[entry.workspace]
  const workspaceLabel = workspace
    ? getWorkspace(workspace).label
    : entry.workspace
  const breadcrumbs: Array<ReactNode> = [
    ...(includeWorkspace && workspaceLabel ? [workspaceLabel] : []),
    ...(rootLabel ? [rootLabel] : []),
    ...parents.map(parent => (
      <ExplorerCardParentLabel key={parent.id} parent={parent} />
    ))
  ]
  return <ContentCard {...card} breadcrumbs={breadcrumbs} />
}

interface ExplorerCardParentLabelProps {
  parent: DashboardEntry
}

function ExplorerCardParentLabel({parent}: ExplorerCardParentLabelProps) {
  const {data} = useAtomValueRaw(parent.data)
  return useAtomValueRaw(data.label)
}

export interface ExplorerCardsProps {
  dragDrop: DragDropProps
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  page: ExplorerReadyPage
  renderEmptyState: () => ReactNode
  locale: string | null
  /**
   * Called when a selectable entry is clicked, pickers that select a single
   * entry confirm it right away
   */
  onPick?: (entry: DashboardEntry) => void
}

export function ExplorerCards({
  dragDrop,
  explorer,
  items,
  onPick,
  page,
  renderEmptyState,
  locale
}: ExplorerCardsProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const selectionMode = explorer.selectionMode
  const hasSelection = selectionMode !== 'none'
  const breadcrumbs =
    explorer.breadcrumbs ||
    page.resultMode === 'matches' ||
    page.searchesEverything
  return (
    <div
      id={explorer.resultsId}
      aria-label="Explorer card results"
      className={styles.ExplorerCards()}
      role="region"
    >
      <ContentGrid
        {...dragDrop}
        aria-label="Explorer entries"
        dropLabel="Drop files to upload"
        items={items}
        dependencies={[breadcrumbs, locale, onPick, page]}
        selectionMode={selectionMode}
        selectionBehavior={explorer.selectionBehavior}
        showSelectionControls={hasSelection && explorer.showSelectionControls}
        selectedKeys={hasSelection ? selected : undefined}
        onSelectionChange={
          hasSelection
            ? selection =>
                setSelected(selection === 'all' ? 'all' : new Set(selection))
            : undefined
        }
        renderEmptyState={renderEmptyState}
      >
        {item => (
          <ExplorerCardItem
            breadcrumbs={breadcrumbs}
            entry={item}
            explorer={explorer}
            locale={locale}
            includeWorkspace={page.searchesEverything}
            onPick={onPick}
          />
        )}
      </ContentGrid>
    </div>
  )
}

function formatExtension(extension?: string) {
  if (!extension) return ''
  return extension.replace(/^\./, '').toUpperCase()
}

function formatFileDetails(file: Infer<typeof MediaFile>) {
  const details = new Array<string>()
  if (file.width && file.height) details.push(`${file.width}×${file.height}`)
  if (typeof file.size === 'number') details.push(prettyBytes(file.size))
  return details.join(' - ')
}
