import {
  ContentCard,
  type ContentCardProps,
  ContentCardSkeleton,
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
import css from './ExplorerCards.module.css'

const styles = styler(css)

interface ExplorerCardItemProps {
  breadcrumbs: boolean
  entry: DashboardEntry
  explorer: DashboardExplorer
  locale: string | null
  includeWorkspace: boolean
}

const ExplorerCardItem = memo(function ExplorerCardItem({
  breadcrumbs,
  entry,
  explorer,
  locale,
  includeWorkspace
}: ExplorerCardItemProps) {
  const {data} = useAtomValueRaw(entry.data)
  const isSelectable = useAtomValueRaw(explorer.isSelectable(entry))
  if (!data)
    return (
      <ContentGridItem
        id={entry.id}
        textValue="Loading entry"
        aria-label="Loading entry"
        selectable={isSelectable}
      >
        <ContentCardSkeleton />
      </ContentGridItem>
    )
  return (
    <ExplorerCardLoadedItem
      breadcrumbs={breadcrumbs}
      entry={entry}
      data={data}
      explorer={explorer}
      locale={locale}
      isSelectable={isSelectable}
      includeWorkspace={includeWorkspace}
    />
  )
})

interface ExplorerCardLoadedItemProps {
  breadcrumbs: boolean
  entry: DashboardEntry
  data: DashboardEntryData
  explorer: DashboardExplorer
  locale: string | null
  isSelectable: boolean
  includeWorkspace: boolean
}

const ExplorerCardLoadedItem = memo(function ExplorerCardLoadedItem({
  breadcrumbs,
  entry,
  data,
  explorer,
  locale,
  isSelectable,
  includeWorkspace
}: ExplorerCardLoadedItemProps) {
  const label = useAtomValueRaw(data.label)
  const icon = useAtomValueRaw(data.icon)
  const type = useAtomValueRaw(data.type)
  const canOpen = useAtomValueRaw(data.canOpen)
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
        image:
          file.extension && isImage(file.extension) ? file.preview : undefined,
        color: file.averageColor,
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
          icon: icon ?? (canOpen ? IcTwotoneFolder : IcTwotoneDescription),
          title: label,
          description: type.label
        }
  return (
    <ContentGridItem
      id={entry.id}
      textValue={label}
      selectable={isSelectable}
      onAction={hasAction ? onAction : undefined}
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
      <ExplorerCardParent key={parent.id} parent={parent} />
    ))
  ]
  return <ContentCard {...card} breadcrumbs={breadcrumbs} />
}

interface ExplorerCardParentProps {
  parent: DashboardEntry
}

function ExplorerCardParent({parent}: ExplorerCardParentProps) {
  const {data} = useAtomValueRaw(parent.data)
  if (!data) return null
  return <ExplorerCardParentLabel parent={data} />
}

interface ExplorerCardParentLabelProps {
  parent: DashboardEntryData
}

function ExplorerCardParentLabel({parent}: ExplorerCardParentLabelProps) {
  return useAtomValueRaw(parent.label)
}

export interface ExplorerCardsProps {
  dragDrop: DragDropProps
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  page: ExplorerReadyPage
  renderEmptyState: () => ReactNode
  locale: string | null
}

export function ExplorerCards({
  dragDrop,
  explorer,
  items,
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
        dependencies={[breadcrumbs, locale, page]}
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
