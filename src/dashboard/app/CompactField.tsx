import {Field} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {isRecord} from '#/core/util/Objects.js'
import {viewsAtom} from '#/dashboard/atoms/core.js'
import {DateField} from '#/field/date/DateField.js'
import {
  LocalisedField,
  selectLocalisedValue
} from '#/field/localiser/Localiser.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw} from 'jotai'
import type {ComponentType, ReactNode} from 'react'
import {useMemo} from 'react'
import {Badge, Button} from '#/components.js'
import css from './CompactField.module.css'

const styles = styler(css)

/** What a compact field shows of a linked entry */
export interface CompactFieldLink {
  title: string
  /** A small data url preview of an image */
  preview?: string
}

export interface CompactFieldContext {
  /** The locale of the entry, picks the value of localised fields */
  locale?: string | null
  /** Titles and previews of the entries linked from the value, by id */
  links?: ReadonlyMap<string, CompactFieldLink>
  /** Makes linked entries clickable, called with the id of the entry */
  onOpenEntry?: (id: string) => void
}

export interface CompactFieldProps extends CompactFieldContext {
  field: Field
  value: unknown
}

export function CompactField({field, value, ...context}: CompactFieldProps) {
  const [resolvedField, resolvedValue] = unlocalise(field, value, context)
  return (
    <CompactFieldView
      field={resolvedField}
      value={resolvedValue}
      {...context}
    />
  )
}

/** Resolves a localised field to its inner field and the entry's locale */
function unlocalise(
  field: Field,
  value: unknown,
  context: CompactFieldContext
): [Field, unknown] {
  if (!(field instanceof LocalisedField)) return [field, value]
  const {inner, locales, fallback} = field.localisation
  if (value !== undefined && value !== null && !isRecord(value))
    return unlocalise(inner, value, context)
  return unlocalise(
    inner,
    selectLocalisedValue({
      value: (value ?? {}) as Record<string, unknown>,
      locale: context.locale ?? null,
      locales,
      fallback
    }),
    context
  )
}

function CompactFieldView({field, value, ...context}: CompactFieldProps) {
  const customView = Field.compactView(field)
  const resolvedViewAtom = useMemo(
    () =>
      atom(get =>
        typeof customView === 'string'
          ? (get(viewsAtom)[customView] as
              | ComponentType<CompactFieldProps>
              | undefined)
          : undefined
      ),
    [customView]
  )
  const ResolvedView = useAtomValueRaw(resolvedViewAtom)
  if (typeof customView === 'function')
    return customView({field, value, ...context})
  if (ResolvedView)
    return <ResolvedView field={field} value={value} {...context} />
  return <CompactFieldFallback field={field} value={value} {...context} />
}

export interface CompactRecordFieldsProps extends CompactFieldContext {
  fields: Record<string, Field>
  layout?: 'inline' | 'footer'
  value: Record<string, unknown>
}

export function CompactRecordFields({
  fields,
  layout = 'inline',
  value,
  ...context
}: CompactRecordFieldsProps) {
  return (
    <span className={styles.CompactField()} data-layout={layout}>
      {renderRecordValue(fields, value, context, {
        includeEmpty: layout === 'footer',
        limit: layout === 'footer' ? undefined : 3
      })}
    </span>
  )
}

export function compactFieldText(
  field: Field,
  value: unknown,
  context: CompactFieldContext = {}
): string {
  const [resolvedField, resolvedValue] = unlocalise(field, value, context)
  return compactResolvedText(resolvedField, resolvedValue, context)
}

function compactResolvedText(
  field: Field,
  value: unknown,
  context: CompactFieldContext
): string {
  const options = Field.options(field) as CompactFieldOptions
  if (isEmptyValue(value)) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string') return stringText(field, value, options)
  if (typeof value === 'number') return numberText(value)
  const links = linkRows(value)
  if (links) return links.map(link => linkLabel(link, context)).join(', ')
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    if (options.schema) return itemCount(value.length)
    const text = options.options ? '' : textContent(value)
    if (text) return text
    return value.map(item => compactValueText(item, options)).join(', ')
  }
  if (options.fields && isRecord(value)) {
    return compactRecordText(Type.fields(options.fields), value, context)
  }
  return compactValueText(value, options)
}

function CompactFieldFallback({field, value, ...context}: CompactFieldProps) {
  return (
    <span className={styles.CompactField()} data-empty={isEmptyValue(value)}>
      {renderCompactValue(field, value, context)}
    </span>
  )
}

function renderCompactValue(
  field: Field,
  value: unknown,
  context: CompactFieldContext
): ReactNode {
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
        {stringText(field, value, options)}
      </span>
    )
  }
  if (typeof value === 'number') {
    return (
      <span className={styles.CompactField.text()}>{numberText(value)}</span>
    )
  }
  const links = linkRows(value)
  if (links) return renderLinks(links, context)
  if (Array.isArray(value)) return renderArrayValue(value, options)
  if (options.fields && isRecord(value)) {
    return renderRecordValue(Type.fields(options.fields), value, context)
  }
  const text = textContent(value)
  if (text) return <span className={styles.CompactField.text()}>{text}</span>
  return <span className={styles.CompactField.json()}>{jsonText(value)}</span>
}

const visibleLinks = 3

function renderLinks(
  links: Array<LinkRow>,
  context: CompactFieldContext
): ReactNode {
  if (links.length === 0)
    return <span className={styles.CompactField.muted()}>-</span>
  const hidden = links.length - visibleLinks
  return (
    <span className={styles.CompactField.items()}>
      {links.slice(0, visibleLinks).map((link, index) => {
        const entryId =
          typeof link._entry === 'string' ? link._entry : undefined
        const preview = entryId
          ? context.links?.get(entryId)?.preview
          : undefined
        const content = (
          <>
            {preview && (
              <img
                alt=""
                className={styles.CompactField.link.preview()}
                src={preview}
              />
            )}
            <span className={styles.CompactField.link.label()}>
              {linkLabel(link, context)}
            </span>
          </>
        )
        const {onOpenEntry} = context
        if (entryId && link._type === 'entry' && onOpenEntry)
          return (
            <Button
              variant="link"
              className={styles.CompactField.link()}
              key={index}
              onClick={() => onOpenEntry(entryId)}
            >
              {content}
            </Button>
          )
        return (
          <span className={styles.CompactField.link()} key={index}>
            {content}
          </span>
        )
      })}
      {hidden > 0 && (
        <span className={styles.CompactField.list.count()}>+{hidden}</span>
      )}
    </span>
  )
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
        <Badge key={index} size="sm">
          {compactValueText(item, options)}
        </Badge>
      ))}
    </span>
  )
}

function renderRecordValue(
  fields: Record<string, Field>,
  value: Record<string, unknown>,
  context: CompactFieldContext,
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
            <CompactField field={field} value={value[key]} {...context} />
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
  value: Record<string, unknown>,
  context: CompactFieldContext
): string {
  return Object.entries(fields)
    .filter(([key, field]) => {
      const options = Field.options(field)
      return !options.hidden && !isEmptyValue(value[key])
    })
    .slice(0, 3)
    .map(([key, field]) => {
      return `${Field.label(field)} ${compactFieldText(field, value[key], context)}`
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

interface LinkRow {
  _type: string
  _entry?: string
  _url?: string
  _title?: string
}

function isLinkRow(value: unknown): value is LinkRow {
  return (
    isRecord(value) &&
    typeof value._type === 'string' &&
    (typeof value._entry === 'string' || typeof value._url === 'string')
  )
}

/** The links of a link field value, undefined if it holds no links */
function linkRows(value: unknown): Array<LinkRow> | undefined {
  if (isLinkRow(value)) return [value]
  if (Array.isArray(value) && value.length > 0 && value.every(isLinkRow))
    return value
  return undefined
}

const linkTypeLabels: Record<string, string> = {
  entry: 'Entry',
  image: 'Image',
  file: 'File',
  url: 'Link'
}

function linkLabel(link: LinkRow, context: CompactFieldContext): string {
  if (typeof link._entry === 'string') {
    const title = context.links?.get(link._entry)?.title
    if (title) return title
  }
  if (typeof link._url === 'string') return link._title || link._url
  return linkTypeLabels[link._type] ?? link._type
}

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 20,
  // Group thousands from five digits on, so years and codes stay intact
  useGrouping: 'min2' as unknown as boolean
})

function numberText(value: number): string {
  return Number.isFinite(value) ? numberFormat.format(value) : String(value)
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC'
})

function dateText(value: string): string {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!match) return value
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date)
}

function stringText(
  field: Field,
  value: string,
  options: CompactFieldOptions
): string {
  if (field instanceof DateField) return dateText(value)
  return options.options?.[value] ?? value
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

interface CompactFieldOptions {
  fields?: Type
  options?: Record<string, string>
  schema?: Record<string, Type>
}
