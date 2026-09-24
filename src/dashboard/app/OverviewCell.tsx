import {Badge, Button, type TableColumn, Timestamp} from '#/components.js'
import type {Config} from '#/core/Config.js'
import type {OverviewCellProps as OverviewCellViewProps} from '#/core/Overview.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {resolveView} from '#/core/View.js'
import {configAtom, viewsAtom} from '#/dashboard/atoms/core.js'
import {
  columnField,
  columnProjection,
  linkedEntryId,
  openEntryAtom,
  type OverviewColumnState,
  overviewEntry,
  type OverviewRow
} from '#/dashboard/atoms/overview.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import type {ReactNode} from 'react'
import {
  CompactField,
  type CompactFieldLink,
  compactFieldText
} from './CompactField.js'
import css from './OverviewCell.module.css'

const styles = styler(css)

const empty = '–'

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 20,
  useGrouping: 'min2' as unknown as boolean
})

/** The table column of an overview column */
export function overviewTableColumn(column: OverviewColumnState): TableColumn {
  return {
    id: column.key,
    header: column.header,
    width: column.width,
    minWidth: column.minWidth,
    align: column.align,
    collapsible: column.collapsible,
    sortable: Boolean(column.sortBy)
  }
}

interface AuditMetadata {
  updatedAt?: number | null
  updatedBy?: {name?: string; email?: string} | null
}

function auditMetadata(row: OverviewRow): AuditMetadata {
  const metadata = row.data.metadata
  return isRecord(metadata) ? (metadata as AuditMetadata) : {}
}

function typeLabel(config: Config, typeName: string) {
  const type = config.schema[typeName]
  return type ? String(Type.label(type)) : typeName
}

/** The text of a cell, for tooltips and the accessible name of its row */
export function overviewCellText(
  config: Config,
  column: OverviewColumnState,
  row: OverviewRow,
  links?: ReadonlyMap<string, CompactFieldLink>
): string {
  const locale = row.locale
  switch (column.builtin) {
    case 'type':
      return typeLabel(config, row.type)
    case 'status':
      return row.status ?? ''
    case 'updated': {
      const updatedAt = auditMetadata(row).updatedAt
      return typeof updatedAt === 'number'
        ? new Date(updatedAt * 1000).toLocaleString()
        : ''
    }
    case 'author':
      return auditMetadata(row).updatedBy?.name ?? ''
  }
  if (column.select && !columnProjection(column.select, row.type)) return ''
  const resolved = columnField(config, column, row.type)
  if (resolved) {
    const [name, field] = resolved
    const text = compactFieldText(field, row.data[name], {locale, links})
    return text === '-' ? '' : text
  }
  const value = row.columns?.[column.key]
  if (column.format) return column.format(value, {locale})
  return valueText(value)
}

/** The ids of the images an image field links to, undefined for other values */
function imageIds(value: unknown): Array<string> | undefined {
  const rows = Array.isArray(value) ? value : [value]
  const images = rows.filter(
    (row): row is {_entry: string} =>
      isRecord(row) && row._type === 'image' && typeof row._entry === 'string'
  )
  if (images.length === 0 || images.length !== rows.length) return undefined
  return images.map(row => row._entry)
}

function valueText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number')
    return Number.isFinite(value) ? numberFormat.format(value) : String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value))
    return value.map(valueText).filter(Boolean).join(', ')
  if (isRecord(value)) {
    const title = value.title ?? value._title
    if (typeof title === 'string') return title
  }
  return ''
}

export interface OverviewCellProps {
  column: OverviewColumnState
  row: OverviewRow
  links?: ReadonlyMap<string, CompactFieldLink>
}

/** The content of an overview cell */
export function OverviewCell({column, row, links}: OverviewCellProps) {
  const config = useAtomValueRaw(configAtom)
  const views = useAtomValueRaw(viewsAtom)
  const openEntry = useSetAtom(openEntryAtom)
  const locale = row.locale
  function onOpenEntry(id: string) {
    void openEntry(id, locale)
  }
  if (column.builtin)
    return <OverviewBuiltinCell column={column} config={config} row={row} />
  const selected = !column.select || columnProjection(column.select, row.type)
  if (!selected) return <OverviewEmpty />
  if (column.view) {
    const View = resolveView<OverviewCellViewProps>(views, column.view)
    if (!View) return <OverviewEmpty />
    return (
      <View
        value={row.columns?.[column.key]}
        entry={overviewEntry(row)}
        column={column.key}
        locale={locale}
      />
    )
  }
  const resolved = columnField(config, column, row.type)
  if (resolved) {
    const [name, field] = resolved
    const stored = row.data[name]
    if (
      stored === undefined ||
      stored === null ||
      stored === '' ||
      (Array.isArray(stored) && stored.length === 0)
    )
      return <OverviewEmpty />
    const images = imageIds(stored)
    if (images) {
      const preview = images.map(id => links?.get(id)?.preview).find(Boolean)
      if (!preview) return <OverviewEmpty />
      return (
        <span className={styles.OverviewCell.thumbnail()}>
          <img
            alt=""
            className={styles.OverviewCell.thumbnail.image()}
            src={preview}
          />
        </span>
      )
    }
    return (
      <CompactField
        field={field}
        value={stored}
        locale={locale}
        links={links}
        onOpenEntry={onOpenEntry}
      />
    )
  }
  const value = row.columns?.[column.key]
  if (column.format) {
    const text = column.format(value, {locale})
    if (!text) return <OverviewEmpty />
    return <span className={styles.OverviewCell.text()}>{text}</span>
  }
  return <OverviewValue value={value} onOpenEntry={onOpenEntry} />
}

interface OverviewBuiltinCellProps {
  column: OverviewColumnState
  config: Config
  row: OverviewRow
}

function OverviewBuiltinCell({column, config, row}: OverviewBuiltinCellProps) {
  switch (column.builtin) {
    case 'type':
      return (
        <span className={styles.OverviewCell.text()}>
          {typeLabel(config, row.type)}
        </span>
      )
    case 'status':
      if (!row.status) return <OverviewEmpty />
      return (
        <Badge size="sm" status={row.status}>
          {row.status}
        </Badge>
      )
    case 'updated': {
      const updatedAt = auditMetadata(row).updatedAt
      if (typeof updatedAt !== 'number') return <OverviewEmpty />
      return (
        <Timestamp
          className={styles.OverviewCell.text()}
          date={updatedAt * 1000}
          format="relative"
        />
      )
    }
    case 'author': {
      const name = auditMetadata(row).updatedBy?.name
      if (!name) return <OverviewEmpty />
      return <span className={styles.OverviewCell.text()}>{name}</span>
    }
  }
  return <OverviewEmpty />
}

function OverviewEmpty() {
  return <span className={styles.OverviewCell.empty()}>{empty}</span>
}

interface OverviewValueProps {
  value: unknown
  onOpenEntry: (id: string) => void
}

const visibleItems = 3

/** Renders a queried value: text, numbers, linked entries or lists of them */
function OverviewValue({value, onOpenEntry}: OverviewValueProps) {
  if (Array.isArray(value)) {
    const items = value.filter(item => valueText(item))
    if (items.length === 0) return <OverviewEmpty />
    const hidden = items.length - visibleItems
    return (
      <span className={styles.OverviewCell.items()}>
        {items.slice(0, visibleItems).map((item, index) => (
          <OverviewItem key={index} value={item} onOpenEntry={onOpenEntry} />
        ))}
        {hidden > 0 && (
          <span className={styles.OverviewCell.count()}>+{hidden}</span>
        )}
      </span>
    )
  }
  if (!valueText(value)) return <OverviewEmpty />
  return <OverviewItem value={value} onOpenEntry={onOpenEntry} />
}

function OverviewItem({value, onOpenEntry}: OverviewValueProps): ReactNode {
  const text = valueText(value)
  const entryId = linkedEntryId(value)
  if (!entryId)
    return <span className={styles.OverviewCell.text()}>{text}</span>
  return (
    <Button
      variant="link"
      className={styles.OverviewCell.link()}
      onClick={() => onOpenEntry(entryId)}
    >
      {text}
    </Button>
  )
}
