import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {useDashboard} from '#/dashboard/hooks.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {useMemo} from 'react'
import {Badge} from './Badge.js'
import css from './CompactField.module.css'

const styles = styler(css)

export interface CompactFieldProps {
  field: Field
  value: unknown
}

export function CompactField({field, value}: CompactFieldProps) {
  const customView = Field.compactView(field)
  const dashboard = useDashboard()
  const customViewKey = typeof customView === 'string' ? customView : ''
  const customViewAtom = useMemo(
    () => dashboard.view(customViewKey),
    [customViewKey, dashboard]
  )
  const ResolvedView = useAtomValue(customViewAtom) as
    | ComponentType<CompactFieldProps>
    | undefined
  if (typeof customView === 'function') return customView({field, value})
  if (ResolvedView) return <ResolvedView field={field} value={value} />
  return <CompactFieldFallback field={field} value={value} />
}

export interface CompactRecordFieldsProps {
  fields: Record<string, Field>
  layout?: 'inline' | 'footer'
  value: Record<string, unknown>
}

export function CompactRecordFields({
  fields,
  layout = 'inline',
  value
}: CompactRecordFieldsProps) {
  return (
    <span className={styles.CompactField()} data-layout={layout}>
      {renderRecordValue(fields, value, {
        includeEmpty: layout === 'footer',
        limit: layout === 'footer' ? undefined : 3
      })}
    </span>
  )
}

export function compactFieldText(field: Field, value: unknown): string {
  const options = Field.options(field) as CompactFieldOptions
  if (isEmptyValue(value)) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return options.options?.[value] ?? value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    if (options.schema) return itemCount(value.length)
    const text = options.options ? '' : textContent(value)
    if (text) return text
    return value.map(item => compactValueText(item, options)).join(', ')
  }
  if (options.fields && isRecord(value)) {
    return compactRecordText(Type.fields(options.fields), value)
  }
  return compactValueText(value, options)
}

function CompactFieldFallback({field, value}: CompactFieldProps) {
  return (
    <span className={styles.CompactField()} data-empty={isEmptyValue(value)}>
      {renderCompactValue(field, value)}
    </span>
  )
}

function renderCompactValue(field: Field, value: unknown): ReactNode {
  const options = Field.options(field) as CompactFieldOptions
  if (isEmptyValue(value))
    return <span className={styles.CompactField.muted()}>-</span>
  if (typeof value === 'boolean') {
    return (
      <span className={styles.CompactField.text()}>{value ? 'Yes' : 'No'}</span>
    )
  }
  if (typeof value === 'string') {
    return (
      <span className={styles.CompactField.text()}>
        {options.options?.[value] ?? value}
      </span>
    )
  }
  if (typeof value === 'number') {
    return <span className={styles.CompactField.text()}>{value}</span>
  }
  if (Array.isArray(value)) return renderArrayValue(value, options)
  if (options.fields && isRecord(value)) {
    return renderRecordValue(Type.fields(options.fields), value)
  }
  return <span className={styles.CompactField.json()}>{jsonText(value)}</span>
}

function renderArrayValue(
  value: Array<unknown>,
  options: CompactFieldOptions
): ReactNode {
  if (value.length === 0)
    return <span className={styles.CompactField.muted()}>-</span>
  if (options.schema) {
    return (
      <span className={styles.CompactField.list.count()}>
        {itemCount(value.length)}
      </span>
    )
  }
  const text = options.options ? '' : textContent(value)
  if (text) return <span className={styles.CompactField.text()}>{text}</span>
  return (
    <span className={styles.CompactField.items()}>
      {value.slice(0, 4).map((item, index) => (
        <Badge key={index} size="small">
          {compactValueText(item, options)}
        </Badge>
      ))}
    </span>
  )
}

function renderRecordValue(
  fields: Record<string, Field>,
  value: Record<string, unknown>,
  options: CompactRecordValueOptions = {}
): ReactNode {
  const includeEmpty = options.includeEmpty ?? false
  const limit = options.limit ?? (includeEmpty ? undefined : 3)
  const entries = Object.entries(fields)
    .filter(([key, field]) => {
      const fieldOptions = Field.options(field)
      return !fieldOptions.hidden && (includeEmpty || !isEmptyValue(value[key]))
    })
    .slice(0, limit)
  if (entries.length === 0)
    return <span className={styles.CompactField.muted()}>-</span>
  return (
    <span className={styles.CompactField.record()}>
      {entries.map(([key, field]) => (
        <span className={styles.CompactField.record.field()} key={key}>
          <span className={styles.CompactField.record.label()}>
            {Field.label(field)}
          </span>
          <span className={styles.CompactField.record.value()}>
            <CompactField field={field} value={value[key]} />
          </span>
        </span>
      ))}
    </span>
  )
}

interface CompactRecordValueOptions {
  includeEmpty?: boolean
  limit?: number
}

function compactRecordText(
  fields: Record<string, Field>,
  value: Record<string, unknown>
): string {
  return Object.entries(fields)
    .filter(([key, field]) => {
      const options = Field.options(field)
      return !options.hidden && !isEmptyValue(value[key])
    })
    .slice(0, 3)
    .map(([key, field]) => {
      return `${Field.label(field)} ${compactFieldText(field, value[key])}`
    })
    .join(', ')
}

function compactValueText(
  value: unknown,
  options: CompactFieldOptions
): string {
  if (isEmptyValue(value)) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return options.options?.[value] ?? value
  if (typeof value === 'number') return String(value)
  const text = textContent(value)
  return text || jsonText(value)
}

function itemCount(length: number): string {
  return `${length} ${length === 1 ? 'item' : 'items'}`
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value))
    return value.map(textContent).filter(Boolean).join(' ')
  if (!isRecord(value)) return ''
  const text = value.text
  const content = value.content
  return [
    typeof text === 'string' ? text : '',
    Array.isArray(content) ? textContent(content) : ''
  ]
    .filter(Boolean)
    .join(' ')
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

interface CompactFieldOptions {
  fields?: Type
  options?: Record<string, string>
  schema?: Record<string, Type>
}
