import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableCell,
  type TableColumn,
  TableRow,
  TableTitle,
  type DragDropProps,
  type IconType
} from '#/components.js'
import {hasPreviewImage} from '#/core/media/Pdf.js'
import styler from '@alinea/styler'
import {useAtom, useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import type {ReactNode} from 'react'
import {startTransition, useMemo} from 'react'
import {configAtom} from '../atoms/core.js'
import type {
  DashboardEntry,
  DashboardExplorer,
  ExplorerItemData,
  ExplorerLinkedEntry,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {explorerItemCanDelete, explorerItemCanMove} from '../atoms/explorer.js'
import {titleColumn as overviewTitle} from '../atoms/overview.js'
import {policyAtom} from '../atoms/user.js'
import {
  IcRoundDelete,
  IcRoundDriveFileMove,
  IcRoundMoreHoriz,
  LucideFile,
  LucideFolder
} from '../icons.js'
import {useExplorerItemActions} from './ExplorerBatchActions.js'
import {fileKindVisual} from './FileKind.js'
import css from './ExplorerTable.module.css'
import {
  OverviewCell,
  overviewCellText,
  overviewTableColumn
} from './OverviewCell.js'
import {overviewStatus, OverviewStatusDot} from './OverviewStatus.js'
import {OverviewThumbnail} from './OverviewThumbnail.js'

const styles = styler(css)

const titleColumn: TableColumn = {
  id: overviewTitle.key,
  header: overviewTitle.header,
  width: '2fr',
  minWidth: 200,
  sortable: true
}

const compactTitleColumn: TableColumn = {
  id: 'title',
  header: 'Title',
  width: '1fr',
  minWidth: 0
}

const compactColumns = [compactTitleColumn]

const actionsColumn: TableColumn = {id: 'actions', header: '', width: 48}

/** Rows with a thumbnail are taller */
const thumbnailRowHeight = 60

/**
 * Overviews show a thumbnail before every title, media lists show their
 * previews there as well
 */
function hasThumbnails(
  compact: boolean,
  overview: boolean,
  page: ExplorerReadyPage
) {
  return !compact && (overview || page.isMedia)
}

interface ExplorerTableRowProps {
  entry: DashboardEntry
  breadcrumbs: boolean
  compact: boolean
  explorer: DashboardExplorer
  locale: string | null
  onPick?: (entry: DashboardEntry) => void
  overview: boolean
  page: ExplorerReadyPage
  /** Show the root before the parents, eg. for results of several roots */
  withRoot: boolean
}

interface ExplorerTableDisplayRowProps extends ExplorerTableRowProps {
  item: ExplorerItemData
  links: ReadonlyMap<string, ExplorerLinkedEntry>
  hasChildren: boolean
  icon: IconType
  isSelectable: boolean
  label: string
  media?: ReactNode
  parents: Array<DashboardEntry>
  rootLabel?: string
}

interface ExplorerTableBreadcrumbsProps {
  entries: Array<DashboardEntry>
  rootLabel?: string
  withRoot: boolean
}

function ExplorerTableBreadcrumbs({
  entries,
  rootLabel,
  withRoot
}: ExplorerTableBreadcrumbsProps) {
  const showRoot = Boolean(rootLabel) && (withRoot || entries.length === 0)
  return (
    <span className={styles.ExplorerTable.breadcrumbs()}>
      {showRoot && (
        <span
          className={styles.ExplorerTable.breadcrumb.root()}
          title={rootLabel}
        >
          {rootLabel}
        </span>
      )}
      {entries.map((entry, index) => (
        <span key={entry.id} className={styles.ExplorerTable.breadcrumb()}>
          <ExplorerTableBreadcrumb
            entry={entry}
            separated={showRoot || index > 0}
          />
        </span>
      ))}
    </span>
  )
}

interface ExplorerTableBreadcrumbProps {
  entry: DashboardEntry
  separated: boolean
}

function ExplorerTableBreadcrumb({
  entry,
  separated
}: ExplorerTableBreadcrumbProps) {
  const {data} = useAtomValueRaw(entry.data)
  const label = useAtomValueRaw(data.label)
  return (
    <span className={styles.ExplorerTable.breadcrumb.label()} title={label}>
      {separated ? `/ ${label}` : label}
    </span>
  )
}

interface ExplorerRowMenuProps {
  entry: DashboardEntry
  explorer: DashboardExplorer
  item: ExplorerItemData
  label: string
  locale: string | null
}

/** Opens, moves or deletes the entry of a row */
function ExplorerRowMenu({
  entry,
  explorer,
  item,
  label,
  locale
}: ExplorerRowMenuProps) {
  const policy = useAtomValueRaw(policyAtom)
  const onAction = useSetAtom(explorer.onAction)
  const actions = useExplorerItemActions()
  const canMove = explorerItemCanMove(policy, item)
  const canDelete = explorerItemCanDelete(policy, item)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        icon={IcRoundMoreHoriz}
        size="icon-sm"
        variant="ghost"
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction(entry, locale)}>
          Open
        </DropdownMenuItem>
        {canMove && (
          <DropdownMenuItem
            icon={IcRoundDriveFileMove}
            disabled={actions.isPending}
            onSelect={() => actions.move([item])}
          >
            Move to…
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            icon={IcRoundDelete}
            variant="destructive"
            disabled={actions.isPending}
            onSelect={() => actions.remove([item])}
          >
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExplorerTableDisplayRow(props: ExplorerTableDisplayRowProps) {
  const {
    breadcrumbs,
    item,
    compact,
    entry,
    explorer,
    hasChildren,
    icon,
    isSelectable,
    label,
    links,
    media,
    onPick,
    overview,
    parents,
    rootLabel,
    withRoot
  } = props
  const config = useAtomValueRaw(configAtom)
  const columns = props.page.overview.columns
  const isExpanded = useAtomValueRaw(explorer.isExpanded(entry))
  const onAction = useSetAtom(explorer.onAction)
  const openLocation = useSetAtom(explorer.openLocation)
  const setExpandedKeys = useSetAtom(explorer.expandedKeys)
  const canExpandOnAction =
    !isSelectable && hasChildren && explorer.supportsInlineExpansion
  const hasAction = explorer.hasRowAction || canExpandOnAction
  function performAction() {
    if (canExpandOnAction) {
      setExpandedKeys(current => new Set(current).add(entry.id))
      return
    }
    onAction(entry, props.locale)
  }
  function pick() {
    onPick?.(entry)
  }
  function enterParent() {
    startTransition(() => openLocation(entry))
  }
  const cellTexts = useMemo(
    () => columns.map(column => overviewCellText(config, column, item, links)),
    [columns, config, item, links]
  )
  const textValue = [label, ...cellTexts].filter(Boolean).join(' ')
  return (
    <TableRow
      id={entry.id}
      textValue={textValue}
      hasChildren={hasChildren}
      selectable={isSelectable}
      highlighted={explorer.linkedKeys.has(entry.id)}
      onAction={
        hasAction && explorer.mode !== 'search' ? performAction : undefined
      }
      onClick={
        hasAction && explorer.mode === 'search'
          ? performAction
          : isSelectable && onPick
            ? pick
            : undefined
      }
      onDoubleClick={hasChildren ? enterParent : undefined}
      rows={
        hasChildren && isExpanded ? (
          <ExplorerTableChildren {...props} />
        ) : undefined
      }
    >
      <TableTitle
        icon={icon}
        media={media}
        title={label}
        status={
          overview ? (
            <OverviewStatusDot status={overviewStatus(item, props.locale)} />
          ) : undefined
        }
        label={
          breadcrumbs ? (
            <ExplorerTableBreadcrumbs
              entries={parents}
              rootLabel={rootLabel}
              withRoot={withRoot}
            />
          ) : undefined
        }
      />
      {!compact &&
        columns.map((column, index) => (
          <TableCell
            key={column.key}
            align={column.align}
            title={cellTexts[index] || undefined}
          >
            <OverviewCell column={column} row={item} links={links} />
          </TableCell>
        ))}
      {overview && (
        <TableCell align="center">
          <ExplorerRowMenu
            entry={entry}
            explorer={explorer}
            item={item}
            label={label}
            locale={props.locale}
          />
        </TableCell>
      )}
    </TableRow>
  )
}

function ExplorerTableChildren(props: ExplorerTableDisplayRowProps) {
  const children = useAtomValueRawSync(
    props.explorer.children(props.entry, props.locale)
  )
  return children.map(child => (
    <ExplorerTableRow
      key={child.id}
      breadcrumbs={props.breadcrumbs}
      compact={props.compact}
      entry={child}
      explorer={props.explorer}
      locale={props.locale}
      onPick={props.onPick}
      overview={props.overview}
      page={props.page}
      withRoot={props.withRoot}
    />
  ))
}

function ExplorerTableRow({explorer, ...props}: ExplorerTableRowProps) {
  const {data} = useAtomValueRaw(props.entry.data)
  const root = useAtomValueRaw(data.root)
  const rootLabel = useAtomValueRaw(root.label)
  const label = useAtomValueRaw(data.label)
  const configuredIcon = useAtomValueRaw(data.icon)
  const fileInfo = useAtomValueRaw(data.fileInfo)
  const hasChildren = useAtomValueRaw(data.hasChildren)
  const item = useAtomValueRaw(data.item)
  const links = useAtomValueRaw(data.linked)
  const parents = useAtomValueRaw(data.parents)
  const isSelectable = useAtomValueRaw(explorer.isSelectable(props.entry))
  const thumbnail = useAtomValueRaw(data.thumbnail)
  const kind = fileInfo ? fileKindVisual(fileInfo.extension) : undefined
  const icon =
    kind?.icon ?? configuredIcon ?? (hasChildren ? LucideFolder : LucideFile)
  const media = hasThumbnails(props.compact, props.overview, props.page) ? (
    <OverviewThumbnail
      icon={icon}
      iconColor={kind?.iconColor}
      image={
        fileInfo?.preview &&
        fileInfo.extension &&
        hasPreviewImage(fileInfo.extension)
          ? fileInfo.preview
          : thumbnail?.preview
      }
      color={fileInfo?.averageColor ?? thumbnail?.averageColor}
    />
  ) : undefined
  return (
    <ExplorerTableDisplayRow
      {...props}
      item={item}
      explorer={explorer}
      hasChildren={
        props.page.resultMode === 'browse' &&
        explorer.supportsInlineExpansion &&
        hasChildren
      }
      icon={icon}
      isSelectable={isSelectable}
      label={label}
      links={links}
      media={media}
      parents={parents}
      rootLabel={rootLabel}
    />
  )
}

export interface ExplorerTableProps {
  compact?: boolean
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
  /** Shown as the overview of a page: thumbnails, parents and row actions */
  overview?: boolean
}

export function ExplorerTable({
  compact = false,
  dragDrop,
  explorer,
  items,
  onPick,
  overview = false,
  page,
  renderEmptyState,
  locale
}: ExplorerTableProps) {
  const [selected, setSelected] = useAtom(explorer.selection)
  const [expandedKeys, setExpandedKeys] = useAtom(explorer.expandedKeys)
  const sort = useSetAtom(explorer.requestedSort)
  const thumbnails = hasThumbnails(compact, overview, page)
  const columns = useMemo(() => {
    const title: TableColumn = thumbnails
      ? {
          ...titleColumn,
          // Line the header up with the titles after their thumbnails
          header: (
            <span className={styles.ExplorerTable.titleHeader()}>
              {titleColumn.header}
            </span>
          )
        }
      : titleColumn
    const rest = page.overview.columns.map(overviewTableColumn)
    return overview ? [title, ...rest, actionsColumn] : [title, ...rest]
  }, [overview, page.overview, thumbnails])
  const sortDescriptor = page.sort.column
    ? {column: page.sort.column.column, direction: page.sort.column.direction}
    : undefined
  const selectionMode = explorer.selectionMode
  const breadcrumbs =
    overview ||
    explorer.breadcrumbs ||
    page.resultMode === 'matches' ||
    page.searchesEverything
  const withRoot = page.searchesEverything || explorer.rootScope === 'workspace'
  const hasSelection = selectionMode !== 'none'
  const showSelectionControls =
    hasSelection &&
    explorer.showSelectionControls &&
    (!compact || selectionMode === 'multiple')

  return (
    <div
      id={explorer.resultsId}
      className={styles.ExplorerTable.viewport({compact, overview})}
    >
      <Table
        {...dragDrop}
        aria-label="Explorer entries"
        className={styles.ExplorerTable({overview})}
        variant={compact ? 'plain' : 'surface'}
        columns={compact ? compactColumns : columns}
        showHeader={!compact}
        rowHeight={thumbnails ? thumbnailRowHeight : undefined}
        sortDescriptor={sortDescriptor}
        onSortChange={
          page.search.trim()
            ? undefined
            : descriptor =>
                startTransition(() =>
                  sort({
                    column: String(descriptor.column),
                    direction: descriptor.direction
                  })
                )
        }
        expandable={explorer.supportsInlineExpansion}
        dependencies={[breadcrumbs, compact, locale, onPick, overview, page]}
        items={items}
        selectionMode={selectionMode}
        selectionBehavior={explorer.selectionBehavior}
        showSelectionControls={showSelectionControls}
        selectedKeys={hasSelection ? selected : undefined}
        onSelectionChange={
          hasSelection
            ? selection =>
                setSelected(selection === 'all' ? 'all' : new Set(selection))
            : undefined
        }
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
        renderEmptyState={renderEmptyState}
      >
        {item => (
          <ExplorerTableRow
            breadcrumbs={breadcrumbs}
            compact={compact}
            entry={item}
            explorer={explorer}
            locale={locale}
            onPick={onPick}
            overview={overview}
            page={page}
            withRoot={withRoot}
          />
        )}
      </Table>
    </div>
  )
}
