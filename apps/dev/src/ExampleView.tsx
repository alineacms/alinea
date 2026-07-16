import type {TextDoc} from 'alinea/core/TextDoc'
import {isRecord} from 'alinea/core/util/Objects'
import {RichText} from 'alinea/ui'
import styles from './ExampleView.module.css'

export interface ExampleViewProps {
  content: Record<string, unknown>
  status: string
  summary?: string
  title: string
  type: string
  url: string
}

interface ValueViewProps {
  value: unknown
}

interface ObjectValueProps {
  value: Record<string, unknown>
}

interface ImageValueProps extends ObjectValueProps {
  src: string
}

interface LinkValueProps extends ObjectValueProps {
  href: string
}

interface FieldViewProps extends ValueViewProps {
  name: string
}

interface ArrayValueProps {
  value: Array<unknown>
}

interface ContentViewProps {
  content: Record<string, unknown>
}

const richTextTypes = new Set([
  'blockquote',
  'bulletList',
  'hardBreak',
  'heading',
  'horizontalRule',
  'listItem',
  'orderedList',
  'paragraph',
  'table',
  'tableCell',
  'tableHeader',
  'tableRow',
  'text'
])

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function label(name: string) {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) return Object.values(value).some(hasContent)
  return true
}

function fields(value: Record<string, unknown>) {
  return Object.entries(value).filter(([name, fieldValue]) => {
    return (
      !name.startsWith('_') &&
      name !== 'metadata' &&
      name !== 'title' &&
      name !== 'summary' &&
      hasContent(fieldValue)
    )
  })
}

function isRichText(value: Array<unknown>): value is TextDoc {
  return value.some(node => {
    return isRecord(node) && richTextTypes.has(String(node._type))
  })
}

function ImageValue({src, value}: ImageValueProps) {
  const caption = text(value.caption)
  return (
    <figure className={styles.ImageValue}>
      {/* The dev app intentionally supports arbitrary CMS media URLs. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.ImageValueImage}
        src={src}
        alt={text(value.alt) ?? text(value.title) ?? 'Content image'}
      />
      {caption && (
        <figcaption className={styles.ImageValueCaption}>{caption}</figcaption>
      )}
    </figure>
  )
}

function LinkValue({href, value}: LinkValueProps) {
  const target = text(value.target) ?? text(value._target)
  return (
    <a
      className={styles.LinkValue}
      href={href}
      target={target}
      rel={target === '_blank' ? 'noreferrer' : undefined}
    >
      {text(value.label) ?? text(value.title) ?? text(value._title) ?? href}
    </a>
  )
}

function ObjectFields({value}: ObjectValueProps) {
  return (
    <dl className={styles.ObjectFields}>
      {fields(value).map(([name, fieldValue]) => (
        <div className={styles.ObjectFieldsRow} key={name}>
          <dt className={styles.ObjectFieldsTerm}>{label(name)}</dt>
          <dd className={styles.ObjectFieldsValue}>
            <ValueView value={fieldValue} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ObjectValue({value}: ObjectValueProps) {
  const url = text(value.url) ?? text(value.location)
  const extension = text(value.extension)
  const isImage =
    typeof value.width === 'number' ||
    typeof value.height === 'number' ||
    Boolean(extension?.match(/^\.(avif|gif|jpe?g|png|svg|webp)$/i)) ||
    Boolean(url?.match(/\.(avif|gif|jpe?g|png|svg|webp)(?:\?.*)?$/i))
  const src = text(value.src) ?? (isImage ? url : undefined)
  if (src) return <ImageValue src={src} value={value} />

  const href = text(value.href) ?? url ?? text(value._url)
  if (href) return <LinkValue href={href} value={value} />

  return <ObjectFields value={value} />
}

function ListValue({value}: ArrayValueProps) {
  return (
    <div className={styles.ListValue}>
      {value.map((item, index) => (
        <article className={styles.ListValueItem} key={index}>
          <ValueView value={item} />
        </article>
      ))}
    </div>
  )
}

function ArrayValue({value}: ArrayValueProps) {
  if (isRichText(value)) {
    return (
      <div className={styles.RichTextValue}>
        <RichText doc={value} />
      </div>
    )
  }
  return <ListValue value={value} />
}

function ValueView({value}: ValueViewProps) {
  if (typeof value === 'boolean') {
    return <span className={styles.BooleanValue}>{value ? 'Yes' : 'No'}</span>
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return <span>{value}</span>
  }
  if (Array.isArray(value)) return <ArrayValue value={value} />
  if (isRecord(value)) return <ObjectValue value={value} />
  return null
}

function FieldView({name, value}: FieldViewProps) {
  return (
    <section className={styles.FieldView}>
      <h2 className={styles.FieldViewTitle}>{label(name)}</h2>
      <ValueView value={value} />
    </section>
  )
}

function ContentView({content}: ContentViewProps) {
  const contentFields = fields(content)
  if (contentFields.length === 0) {
    return (
      <p className={styles.ContentViewEmpty}>
        This entry has no content yet. Add some in the dashboard to see it here.
      </p>
    )
  }
  return (
    <div className={styles.ContentView}>
      {contentFields.map(([name, value]) => (
        <FieldView key={name} name={name} value={value} />
      ))}
    </div>
  )
}

export function ExampleView(props: ExampleViewProps) {
  return (
    <main className={styles.ExampleView}>
      <header className={styles.ExampleViewHeader}>
        <p className={styles.ExampleViewEyebrow}>Alinea example</p>
        <h1 className={styles.ExampleViewTitle}>{props.title}</h1>
        {props.summary && (
          <p className={styles.ExampleViewSummary}>{props.summary}</p>
        )}
        <div className={styles.ExampleViewDetails}>
          <span className={styles.ExampleViewDetail}>{label(props.type)}</span>
          <span className={styles.ExampleViewDetail}>{props.status}</span>
          <span className={styles.ExampleViewDetail}>{props.url}</span>
        </div>
      </header>
      <ContentView content={props.content} />
    </main>
  )
}
