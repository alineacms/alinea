import type {FieldOptions} from '#/core/Field.js'
import {Field} from '#/core/Field.js'
import type {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import {Icon} from '#/components.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {ComponentType} from 'react'
import type {ReactNode} from 'react'
import {useMemo} from 'react'
import {
  Button as AriaButton,
  Cell,
  Checkbox,
  Column,
  Row,
  Table,
  TableBody,
  TableHeader,
  TableLayout,
  type DragAndDropHooks,
  type Key,
  Virtualizer
} from 'react-aria-components'
import type {TableLayoutProps} from 'react-stately/useVirtualizerState'
import type {DashboardEntry, DashboardExplorer} from '../store.js'
import {LucideFile, LucideFolder} from '../icons.js'
import {Surface} from './ui/Surface.js'
import css from './ExplorerTable.module.css'

const styles = styler(css)

interface OverviewField {
  field: Field
  key: string
}

interface OverviewCell {
  id: string
  label: string
  value: string
}

interface OverviewRow {
  cells: Array<OverviewCell>
  icon: ComponentType
  label: string
}

interface ExplorerTableColumn {
  id: string
  index?: number
  kind: 'selection' | 'title' | 'overview' | 'filler'
  width: number | '1fr'
}

interface OverviewFieldOptions extends FieldOptions<unknown> {
  options?: Record<string, string>
}

function overviewFields(type: Type): Array<OverviewField> {
  return Object.entries(Type.fields(type)).flatMap(([key, field]) => {
    const options = Field.options(field) as FieldOptions<unknown>
    if (options.hidden || options.overview !== true) return []
    if (key === 'title') return []
    return [{key, field}]
  })
}

function formatOverviewValue(
  value: unknown,
  options: OverviewFieldOptions
): string {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    return value.map(item => formatOverviewValue(item, options)).join(', ')
  }
  if (typeof value === 'string') {
    return options.options?.[value] ?? value
  }
  if (typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise
}

function entryOverviewValues(
  entry: Entry | null,
  type: Type
): Array<OverviewCell> {
  const data = entry?.data ?? {}
  return overviewFields(type).map(({field, key}) => {
    const options = Field.options(field) as OverviewFieldOptions
    return {
      id: key,
      label: Field.label(field),
      value: formatOverviewValue(data[key], options)
    }
  })
}

function useOverviewColumnCount(items: Array<DashboardEntry>): number {
  const columns = useMemo(
    () =>
      atom(get => {
        let count = 0
        for (const item of items) {
          const {data} = get(item.data)
          if (!data) continue
          const type = get(data.type).type
          count = Math.max(count, overviewFields(type).length)
        }
        return count
      }),
    [items]
  )
  return useAtomValue(columns)
}

interface ExplorerTableRowProps {
  columnById: Map<Key, ExplorerTableColumn>
  columns: Array<ExplorerTableColumn>
  entry: DashboardEntry
}

function ExplorerTableRow({
  columnById,
  columns,
  entry
}: ExplorerTableRowProps) {
  const row = useAtomValue(
    useMemo(
      () =>
        atom((get): OverviewRow => {
          const {data} = get(entry.data)
          if (!data)
            return {
              label: 'Loading entry',
              icon: LucideFile,
              cells: []
            }
          const label = get(data.label)
          const type = get(data.type).type
          const current = get(data.currentEntry)
          const icon =
            get(data.icon) ??
            (get(data.hasChildren) ? LucideFolder : LucideFile)
          if (isPromise(current)) throw current
          return {
            label,
            icon,
            cells: entryOverviewValues(current, type)
          }
        }),
      [entry]
    )
  )
  function renderCell(columnOrId: ExplorerTableColumn | Key) {
    const column =
      typeof columnOrId === 'object' ? columnOrId : columnById.get(columnOrId)
    if (!column) return <Cell />
    if (column.kind === 'selection') {
      return (
        <Cell className={styles.ExplorerTable.cell.selection()}>
          <Checkbox
            slot="selection"
            className={styles.ExplorerTable.checkbox()}
            aria-label={`Select ${row.label}`}
          >
            <span className={styles.ExplorerTable.checkbox.mark()} />
          </Checkbox>
        </Cell>
      )
    }
    if (column.kind === 'title') {
      return (
        <Cell
          className={styles.ExplorerTable.cell.title()}
          textValue={row.label}
        >
          <AriaButton
            slot="drag"
            className={styles.ExplorerTable.iconDrag()}
            aria-label={`Drag ${row.label}`}
          >
            <Icon icon={row.icon} className={styles.ExplorerTable.icon()} />
          </AriaButton>
          <span className={styles.ExplorerTable.titleAction()}>
            {row.label}
          </span>
        </Cell>
      )
    }
    if (column.kind === 'filler') {
      return <Cell className={styles.ExplorerTable.cell.filler()} />
    }
    const cell =
      typeof column.index === 'number' ? row.cells[column.index] : undefined
    return (
      <Cell
        className={styles.ExplorerTable.cell()}
        textValue={cell ? `${cell.label} ${cell.value}` : undefined}
      >
        {cell && (
          <span className={styles.ExplorerTable.field()}>
            <span className={styles.ExplorerTable.field.label()}>
              {cell.label}
            </span>
            <span className={styles.ExplorerTable.field.value()}>
              {cell.value}
            </span>
          </span>
        )}
      </Cell>
    )
  }
  return (
    <Row
      id={entry.id}
      textValue={row.label}
      className={styles.ExplorerTable.row()}
      columns={columns}
      dependencies={[columns, row.cells]}
      style={{width: '100%', minWidth: '100%', height: 'inherit'}}
    >
      {renderCell}
    </Row>
  )
}

export interface ExplorerTableProps {
  dragAndDropHooks: DragAndDropHooks<DashboardEntry>
  explorer: DashboardExplorer
  items: Array<DashboardEntry>
  renderEmptyState: () => ReactNode
}

export function ExplorerTable({
  dragAndDropHooks,
  explorer,
  items,
  renderEmptyState
}: ExplorerTableProps) {
  const columnCount = useOverviewColumnCount(items)
  const [selected, setSelected] = useAtom(explorer.selection)
  const onAction = useSetAtom(explorer.onAction)
  function onItemAction(key: Key) {
    const entry = items.find(item => item.id === String(key))
    if (entry) onAction(entry)
  }
  const columns = useMemo<Array<ExplorerTableColumn>>(
    () => [
      {id: 'selection', kind: 'selection', width: 30},
      {id: 'title', kind: 'title', width: 260},
      ...Array.from({length: columnCount}, (_, index) => ({
        id: `overview-${index}`,
        index,
        kind: 'overview' as const,
        width: 180
      })),
      {id: 'filler', kind: 'filler', width: '1fr'}
    ],
    [columnCount]
  )
  const columnById = useMemo(
    () => new Map(columns.map(column => [column.id, column] as const)),
    [columns]
  )
  const layoutOptions = useMemo<TableLayoutProps>(
    () => ({
      rowHeight: 32,
      headingHeight: 0,
      padding: 0,
      gap: 0
    }),
    []
  )
  return (
    <div className={styles.ExplorerTable.viewport()}>
      <Surface className={styles.ExplorerTable.surface()}>
        <Virtualizer layout={TableLayout} layoutOptions={layoutOptions}>
          <Table
            aria-label="Explorer entries"
            className={styles.ExplorerTable()}
            dragAndDropHooks={dragAndDropHooks}
            selectedKeys={selected}
            selectionMode={explorer.selectionMode}
            onSelectionChange={setSelected}
            onRowAction={onItemAction}
            style={{display: 'block', width: '100%', height: '100%'}}
          >
            <TableHeader
              className={styles.ExplorerTable.header()}
              columns={columns}
            >
              {column => (
                <Column
                  id={column.id}
                  isRowHeader={column.kind === 'title'}
                  maxWidth={
                    column.kind === 'selection' ? 30 : undefined
                  }
                  minWidth={
                    column.kind === 'selection' ? 30 : undefined
                  }
                  width={column.width}
                  className={
                    column.kind === 'selection'
                        ? styles.ExplorerTable.column.selection()
                      : column.kind === 'filler'
                        ? styles.ExplorerTable.column.filler()
                      : styles.ExplorerTable.column()
                  }
                />
              )}
            </TableHeader>
            <TableBody
              className={styles.ExplorerTable.body()}
              dependencies={[columns]}
              items={items}
              renderEmptyState={() => (
                <div className={styles.ExplorerTable.empty()}>
                  {renderEmptyState()}
                </div>
              )}
            >
              {item => (
                <ExplorerTableRow
                  columnById={columnById}
                  columns={columns}
                  entry={item}
                />
              )}
            </TableBody>
          </Table>
        </Virtualizer>
      </Surface>
    </div>
  )
}
