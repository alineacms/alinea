import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {isRecord} from 'alinea/core/util/Objects'
import {slugify} from 'alinea/core/util/Slugs'
import NextLink from 'next/link'
import type {ComponentType, HTMLProps} from 'react'
import {WebText} from '@/layout/WebText'
import {ChapterLinkView} from '@/page/blocks/ChapterLinkView'
import {CodeBlockView} from '@/page/blocks/CodeBlockView'
import {CodeVariantsView} from '@/page/blocks/CodeVariantsView'
import {ComponentCatalogView} from '@/page/blocks/ComponentCatalogView'
import {ComponentExampleView} from '@/page/blocks/ComponentExampleView'
import {ComponentPropsView} from '@/page/blocks/ComponentPropsView'
import {CopyPromptView} from '@/page/blocks/CopyPromptView'
import {ExampleBlockView} from '@/page/blocks/ExampleBlockView'
import {FieldCatalogView} from '@/page/blocks/FieldCatalogView'
import {ImageBlockView} from '@/page/blocks/ImageBlockView'
import {NoticeView} from '@/page/blocks/NoticeView'
import type {bodyField} from '@/schema/fields/BodyField'
import css from './DocBody.module.scss'
import {DocInlineText} from './DocInlineText'

const styles = styler(css)

export type DocBodyDoc = Infer<ReturnType<typeof bodyField>>
type DocBodyNode = DocBodyDoc[number]

interface DocHeading {
  id: string
  title: string
}

const stepPattern = /^(\d+)\.\s+/

function textContent(nodes: unknown): string {
  if (!Array.isArray(nodes)) return ''
  return nodes
    .map(node => {
      if (!node || typeof node !== 'object') return ''
      if ('text' in node && typeof node.text === 'string') return node.text
      if ('content' in node) return textContent(node.content)
      return ''
    })
    .join('')
}

function isH2(node: DocBodyNode) {
  return node._type === 'heading' && 'level' in node && node.level === 2
}

function headingText(node: DocBodyNode) {
  return textContent('content' in node ? node.content : undefined)
}

/** Moves the number of a step heading ("1. Install") to an attribute */
function withStep(node: DocBodyNode): DocBodyNode {
  if (!('content' in node) || !Array.isArray(node.content)) return node
  const [first, ...rest]: Array<unknown> = node.content
  if (!isRecord(first) || typeof first.text !== 'string') return node
  const match = first.text.match(stepPattern)
  if (!match) return node
  return {
    ...node,
    'data-step': match[1],
    content: [{...first, text: first.text.slice(match[0].length)}, ...rest]
  } as DocBodyNode
}

/**
 * Anchors every heading to a unique slug of its text, the "On this page"
 * navigation links to these
 */
export function withHeadingAnchors(body: DocBodyDoc): DocBodyDoc {
  const seen = new Map<string, number>()
  return body.map(node => {
    if (node._type !== 'heading') return node
    const slug = slugify(headingText(node))
    const count = (seen.get(slug) ?? 0) + 1
    seen.set(slug, count)
    return withStep({...node, _anchor: count > 1 ? `${slug}-${count}` : slug})
  })
}

function headingOf(node: DocBodyNode): DocHeading {
  const text = headingText(node)
  return {
    id: '_anchor' in node ? String(node._anchor) : slugify(text),
    title: text.replaceAll('`', '').trim()
  }
}

/** The h2 headings of a doc, used for the "On this page" navigation */
export function docHeadings(body: DocBodyDoc): Array<DocHeading> {
  return body.filter(isH2).map(headingOf)
}

/** Splits off an opening paragraph so it can be shown as the page lead */
export function splitLead(body: DocBodyDoc) {
  const [first, ...rest] = body
  if (first?._type === 'paragraph' && rest.length > 0)
    return {lead: [first], rest}
  return {lead: undefined, rest: body}
}

function DocLink({href, ...props}: HTMLProps<HTMLAnchorElement>) {
  if (href?.startsWith('/'))
    return <NextLink href={href} {...props} className={styles.link()} />
  return <a href={href} {...props} className={styles.link()} />
}

interface DocHeadingProps extends HTMLProps<HTMLHeadingElement> {
  'data-step'?: string
}

function DocHeadingTag(Tag: 'h2' | 'h3' | 'h4') {
  return function DocHeading({
    id,
    children,
    'data-step': step
  }: DocHeadingProps) {
    const content = (
      <>
        {step && <span className={styles.step()}>{step}. </span>}
        {children}
      </>
    )
    return (
      <Tag id={id} className={styles[Tag]()}>
        {id ? (
          <a href={`#${id}`} className={styles.anchor()}>
            {content}
          </a>
        ) : (
          content
        )}
      </Tag>
    )
  }
}

/**
 * Wraps a block view so the body flow owns the space around it. Wide blocks,
 * such as the catalogs, may use the full width of a wide page.
 */
function docBlock<Props extends object>(
  View: ComponentType<Props>,
  wide = false
) {
  return function DocBlock(props: Props) {
    return (
      <div className={styles.block({wide})}>
        <View {...props} />
      </div>
    )
  }
}

const catalogBlocks = new Set(['FieldCatalogBlock', 'ComponentCatalogBlock'])

/** Pages with a catalog are laid out wider, without the table of contents */
export function hasCatalog(body: DocBodyDoc) {
  return body.some(node => catalogBlocks.has(node._type))
}

const DocCodeBlock = docBlock(CodeBlockView)
const DocCodeVariants = docBlock(CodeVariantsView)
const DocExample = docBlock(ExampleBlockView)
const DocChapterLink = docBlock(ChapterLinkView)
const DocNotice = docBlock(NoticeView)
const DocImage = docBlock(ImageBlockView)
const DocCopyPrompt = docBlock(CopyPromptView)
const DocFieldCatalog = docBlock(FieldCatalogView, true)
const DocComponentCatalog = docBlock(ComponentCatalogView, true)
const DocComponentExample = docBlock(ComponentExampleView)
const DocComponentProps = docBlock(ComponentPropsView)

const DocH2 = DocHeadingTag('h2')
const DocH3 = DocHeadingTag('h3')
const DocH4 = DocHeadingTag('h4')

interface DocTextProps {
  doc: DocBodyDoc
}

function DocText({doc}: DocTextProps) {
  return (
    <WebText
      doc={doc}
      text={DocInlineText}
      p={<p className={styles.p()} />}
      h2={DocH2}
      h3={DocH3}
      h4={DocH4}
      a={DocLink}
      ul={<ul className={styles.list()} />}
      ol={<ol className={styles.list('ordered')} />}
      li={<li className={styles.listItem()} />}
      blockquote={<blockquote className={styles.blockquote()} />}
      CodeBlock={DocCodeBlock}
      CodeVariantsBlock={DocCodeVariants}
      ExampleBlock={DocExample}
      ChapterLinkBlock={DocChapterLink}
      NoticeBlock={DocNotice}
      ImageBlock={DocImage}
      CopyPromptBlock={DocCopyPrompt}
      FieldCatalogBlock={DocFieldCatalog}
      ComponentCatalogBlock={DocComponentCatalog}
      ComponentExampleBlock={DocComponentExample}
      ComponentPropsBlock={DocComponentProps}
    />
  )
}

export interface DocLeadProps {
  doc: DocBodyDoc
}

export function DocLead({doc}: DocLeadProps) {
  return (
    <WebText
      doc={doc}
      text={DocInlineText}
      p={<p className={styles.lead()} />}
      a={DocLink}
    />
  )
}

export interface DocBodyProps {
  body: DocBodyDoc
  /** Keeps text at a readable width while wide blocks use the full width */
  wide?: boolean
}

export function DocBody({body, wide}: DocBodyProps) {
  return (
    <div className={styles.root({wide})}>
      <DocText doc={body} />
    </div>
  )
}
