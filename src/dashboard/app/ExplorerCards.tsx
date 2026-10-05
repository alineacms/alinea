import {
  ContentCard,
  type ContentCardProps,
  ContentGrid,
  ContentGridItem,
  type DragDropProps,
  Timestamp
} from '#/components.js'
import {getWorkspace} from '#/core/Internal.js'
import {hasPreviewImage} from '#/core/media/Pdf.js'
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
import {isAtLocation} from '../atoms/explorer.js'
import {IcTwotoneDescription, IcTwotoneFolder} from '../icons.js'
import {fileKindVisual} from './FileKind.js'
import css from './ExplorerCards.module.css'
import {auditMetadata} from './OverviewCell.js'
import {overviewStatus, OverviewStatusDot} from './OverviewStatus.js'

const styles = styler(css)

interface ExplorerCardItemProps {
  breadcrumbs: boolean
  entry: DashboardEntry
  explorer: DashboardExplorer
  locale: string | null
  includeWorkspace: boolean
  onPick?: (entry: DashboardEntry) => void
  overview: boolean
  page: ExplorerReadyPage
  /** Show the root before the parents, eg. for results of several roots */
  withRoot: boolean
}

const ExplorerCardItem = memo(function ExplorerCardItem({
  breadcrumbs,
  entry,
  explorer,
  locale,
  includeWorkspace,
  onPick,
  overview,
  page,
  withRoot
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
  const item = useAtomValueRaw(data.item)
  const base: ContentCardProps = file
    ? {
        variant: 'media',
        ...(file.preview && file.extension && hasPreviewImage(file.extension)
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
          description: type.label === label ? undefined : type.label
        }
      : {
          // Like the tree and table, only entries with children are folders
          icon: icon ?? (hasChildren ? IcTwotoneFolder : IcTwotoneDescription),
          title: label,
          description: type.label === label ? undefined : type.label
        }
  const {updatedAt, updatedBy} = auditMetadata(item)
  const card: ContentCardProps = overview
    ? {
        ...base,
        title: (
          <span className={styles.ExplorerCards.title()}>
            <span className={styles.ExplorerCards.title.text()}>{label}</span>
            <OverviewStatusDot status={overviewStatus(item, locale)} />
          </span>
        ),
        description:
          !file && typeof updatedAt === 'number' ? (
            <>
              {updatedBy?.name && `${updatedBy.name} · `}
              <Timestamp date={updatedAt * 1000} format="date" />
            </>
          ) : (
            base.description
          )
      }
    : base
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
          page={page}
          {...card}
          data={data}
          entry={entry}
          includeWorkspace={includeWorkspace}
          joined={overview}
          withRoot={withRoot || !overview}
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
  page: ExplorerReadyPage
  includeWorkspace: boolean
  /** Show the location as one line of names separated by slashes */
  joined: boolean
  withRoot: boolean
}

/** A card with the location of its entry as breadcrumbs */
function ExplorerLocatedCard({
  data,
  entry,
  includeWorkspace,
  joined,
  page,
  withRoot,
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
  const showRoot = Boolean(rootLabel) && (withRoot || parents.length === 0)
  const breadcrumbs: Array<ReactNode> = [
    ...(includeWorkspace && workspaceLabel ? [workspaceLabel] : []),
    ...(showRoot ? [rootLabel] : []),
    ...parents.map(parent => (
      <ExplorerCardParentLabel key={parent.id} parent={parent} />
    ))
  ]
  if (isAtLocation(entry, parents, page)) return <ContentCard {...card} />
  if (!joined) return <ContentCard {...card} breadcrumbs={breadcrumbs} />
  const location = breadcrumbs.map((crumb, index) => (
    <span key={index}>
      {index > 0 && ' / '}
      {crumb}
    </span>
  ))
  return <ContentCard {...card} breadcrumbs={[location]} />
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
  /** Shown as the overview of a page: parents, status and who updated it */
  overview?: boolean
}

export function ExplorerCards({
  dragDrop,
  explorer,
  items,
  onPick,
  overview = false,
  page,
  renderEmptyState,
  locale
}: ExplorerCardsProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const selectionMode = explorer.selectionMode
  const hasSelection = selectionMode !== 'none'
  const breadcrumbs =
    overview ||
    explorer.breadcrumbs ||
    page.resultMode === 'matches' ||
    page.searchesEverything
  const withRoot = page.searchesEverything || explorer.rootScope === 'workspace'
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
        dependencies={[breadcrumbs, locale, onPick, overview, page]}
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
            overview={overview}
            page={page}
            withRoot={withRoot}
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
