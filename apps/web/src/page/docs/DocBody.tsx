import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import {slugify} from 'alinea/core/util/Slugs'
import NextLink from 'next/link'
import type {HTMLProps} from 'react'
import {WebText} from '@/layout/WebText'
import {ChapterLinkView} from '@/page/blocks/ChapterLinkView'
import {CodeBlockView} from '@/page/blocks/CodeBlockView'
import {CodeVariantsView} from '@/page/blocks/CodeVariantsView'
import {CopyPromptView} from '@/page/blocks/CopyPromptView'
import {ExampleBlockView} from '@/page/blocks/ExampleBlockView'
import {ImageBlockView} from '@/page/blocks/ImageBlockView'
import {NoticeView} from '@/page/blocks/NoticeView'
import type {bodyField} from '@/schema/fields/BodyField'
import css from './DocBody.module.scss'

const styles = styler(css)

export type DocBodyDoc = Infer<ReturnType<typeof bodyField>>
type DocBodyNode = DocBodyDoc[number]

interface DocHeading {
  id: string
  title: string
  step?: number
}

const stepPattern = /^(\d+)\.\s+(.+)$/

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

function headingOf(node: DocBodyNode): DocHeading {
  const text = textContent('content' in node ? node.content : undefined)
  const plain = text.replaceAll('`', '').trim()
  const match = plain.match(stepPattern)
  return {
    id: slugify(text),
    title: match ? match[2] : plain,
    step: match ? Number(match[1]) : undefined
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

function DocHeadingTag(Tag: 'h2' | 'h3' | 'h4') {
  return function DocHeading({id, children}: HTMLProps<HTMLHeadingElement>) {
    return (
      <Tag id={id} className={styles[Tag]()}>
        {id ? (
          <a href={`#${id}`} className={styles.anchor()}>
            {children}
          </a>
        ) : (
          children
        )}
      </Tag>
    )
  }
}

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
      p={<p className={styles.p()} />}
      h2={DocH2}
      h3={DocH3}
      h4={DocH4}
      a={DocLink}
      ul={<ul className={styles.list()} />}
      ol={<ol className={styles.list('ordered')} />}
      li={<li className={styles.listItem()} />}
      blockquote={<blockquote className={styles.blockquote()} />}
      CodeBlock={CodeBlockView}
      CodeVariantsBlock={CodeVariantsView}
      ExampleBlock={ExampleBlockView}
      ChapterLinkBlock={ChapterLinkView}
      NoticeBlock={NoticeView}
      ImageBlock={ImageBlockView}
      CopyPromptBlock={CopyPromptView}
    />
  )
}

export interface DocLeadProps {
  doc: DocBodyDoc
}

export function DocLead({doc}: DocLeadProps) {
  return <WebText doc={doc} p={<p className={styles.lead()} />} a={DocLink} />
}

interface DocSection {
  heading: DocHeading
  nodes: DocBodyDoc
}

export interface DocBodyProps {
  body: DocBodyDoc
}

export function DocBody({body}: DocBodyProps) {
  const headings = docHeadings(body)
  const isSteps =
    headings.length > 1 && headings.every(heading => heading.step !== undefined)
  if (!isSteps)
    return (
      <div className={styles.root()}>
        <DocText doc={body} />
      </div>
    )
  const firstHeading = body.findIndex(isH2)
  const intro = body.slice(0, firstHeading)
  const sections: Array<DocSection> = []
  for (const node of body.slice(firstHeading)) {
    if (isH2(node)) sections.push({heading: headingOf(node), nodes: []})
    else sections[sections.length - 1].nodes.push(node)
  }
  return (
    <div className={styles.root()}>
      {intro.length > 0 && <DocText doc={intro} />}
      <ol className={styles.steps()}>
        {sections.map(({heading, nodes}) => (
          <li key={heading.id} className={styles.step()}>
            <div className={styles.step.rail()} aria-hidden="true">
              <span className={styles.step.number()}>{heading.step}</span>
              <span className={styles.step.line()} />
            </div>
            <div className={styles.step.content()}>
              <h2 id={heading.id} className={styles.step.title()}>
                <a href={`#${heading.id}`} className={styles.anchor()}>
                  {heading.title}
                </a>
              </h2>
              <DocText doc={nodes} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
