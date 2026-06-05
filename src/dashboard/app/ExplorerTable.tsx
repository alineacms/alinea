import type {FieldOptions} from '#/core/Field.js'
import {Field} from '#/core/Field.js'
import type {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import type {MouseEvent, PointerEvent} from 'react'
import type {ReactNode} from 'react'
import {useMemo} from 'react'
import {
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
  label: string
}

interface ExplorerTableColumn {
  id: string
  index?: number
  kind: 'selection' | 'title' | 'overview'
  width: number
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
  explorer: DashboardExplorer
}

function ExplorerTableRow({
  columnById,
  columns,
  entry,
  explorer
}: ExplorerTableRowProps) {
  const row = useAtomValue(
    useMemo(
      () =>
        atom((get): OverviewRow => {
          const {data} = get(entry.data)
          if (!data) return {label: 'Loading entry', cells: []}
          const label = get(data.label)
          const type = get(data.type).type
          const current = get(data.currentEntry)
          if (isPromise(current)) throw current
          return {
            label,
            cells: entryOverviewValues(current, type)
          }
        }),
      [entry]
    )
  )
  const onAction = useSetAtom(explorer.onAction)
  function openEntry(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onAction(entry)
  }
  function stopTitlePointerSelection(event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation()
  }
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
          <button
            type="button"
            className={styles.ExplorerTable.titleAction()}
            onClick={openEntry}
            onPointerDown={stopTitlePointerSelection}
          >
            {row.label}
          </button>
        </Cell>
      )
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
      style={{width: 'inherit', minWidth: '100%', height: 'inherit'}}
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
  const columnWidths = useMemo(() => {
    const widths = new Map<Key, number>()
    widths.set('selection', 16)
    widths.set('title', 260)
    for (let index = 0; index < columnCount; index += 1) {
      widths.set(`overview-${index}`, 180)
    }
    return widths
  }, [columnCount])
  const columns = useMemo<Array<ExplorerTableColumn>>(
    () => [
      {id: 'selection', kind: 'selection', width: 16},
      {id: 'title', kind: 'title', width: 260},
      ...Array.from({length: columnCount}, (_, index) => ({
        id: `overview-${index}`,
        index,
        kind: 'overview' as const,
        width: 180
      }))
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
      headingHeight: 1,
      padding: 0,
      gap: 0,
      columnWidths
    }),
    [columnWidths]
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
            selectionBehavior={explorer.selectionBehavior}
            selectionMode={explorer.selectionMode}
            onSelectionChange={setSelected}
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
                    column.kind === 'selection' ? column.width : undefined
                  }
                  minWidth={
                    column.kind === 'selection' ? column.width : undefined
                  }
                  width={column.width}
                  className={
                    column.kind === 'selection'
                      ? styles.ExplorerTable.column.selection()
                      : styles.ExplorerTable.column()
                  }
                />
              )}
            </TableHeader>
            <TableBody
              dependencies={[columns]}
              items={items}
              renderEmptyState={renderEmptyState}
            >
              {item => (
                <ExplorerTableRow
                  columnById={columnById}
                  columns={columns}
                  entry={item}
                  explorer={explorer}
                />
              )}
            </TableBody>
          </Table>
        </Virtualizer>
      </Surface>
    </div>
  )
}
