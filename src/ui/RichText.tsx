import type {Infer} from 'alinea/core/Infer'
import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  type TextDoc,
  TextNode
} from 'alinea/core/TextDoc'
import {slugify} from 'alinea/core/util/Slugs'
import {
  type ComponentType,
  type CSSProperties,
  Fragment,
  isValidElement,
  type JSX,
  type ReactElement,
  type ReactNode
} from 'react'

type Element = keyof JSX.IntrinsicElements
type Attributes = Record<string, unknown>
type View = ComponentType<Attributes & {children?: ReactNode}> | ReactElement
type TextAlign = CSSProperties['textAlign']
type NoInferType<T> = [T][T extends unknown ? 0 : never]
type RichTextBlockViews<Blocks extends object> = {
  [K in keyof Blocks]?: ComponentType<Infer<Blocks[K]>>
}
interface RichTextBaseProps<Blocks extends object> {
  doc: TextDoc<Blocks>
  text?: ComponentType<{children: string | undefined}>
}

function textContent(doc: TextDoc): string {
  return doc.reduce((text, node) => {
    if (Node.isText(node)) return text + (node.text ?? '')
    if ('content' in node && Array.isArray(node.content))
      return text + textContent(node.content)
    return text
  }, '')
}

function nodeElement(
  type: string,
  attributes: Attributes | undefined,
  content?: TextDoc
): ReactElement<Attributes, Element> | undefined {
  const textAlign = textAlignAttribute(attributes?.textAlign)
  const style = {
    textAlign: textAlign === 'left' ? undefined : textAlign
  }
  switch (type) {
    case 'heading': {
      const level = attributes?.level
      const Tag = headingTag(level)
      const id =
        attributes?.id ?? (content ? slugify(textContent(content)) : undefined)
      return <Tag style={style} id={typeof id === 'string' ? id : undefined} />
    }
    case 'paragraph':
      return <p style={style} />
    case 'bold':
      return <b />
    case 'italic':
      return <i />
    case 'bulletList':
      return <ul style={style} />
    case 'orderedList':
      return <ol style={style} />
    case 'listItem':
      return <li />
    case 'blockquote':
      return <blockquote style={style} />
    case 'horizontalRule':
      return <hr />
    case 'hardBreak':
      return <br />
    case 'small':
      return <small />
    case 'subscript':
      return <sub />
    case 'superscript':
      return <sup />
    case 'link': {
      const href = attributes?.href
      const target = attributes?.target
      const title = attributes?.title
      return (
        <a
          href={typeof href === 'string' ? href : undefined}
          target={typeof target === 'string' ? target : undefined}
          title={typeof title === 'string' ? title : undefined}
        />
      )
    }
    case 'table':
      return <table />
    case 'tableBody':
      return <tbody />
    case 'tableCell':
      return (
        <td
          colSpan={numberAttribute(attributes?.colspan)}
          rowSpan={numberAttribute(attributes?.rowspan)}
        />
      )
    case 'tableHeader':
      return (
        <th
          colSpan={numberAttribute(attributes?.colspan)}
          rowSpan={numberAttribute(attributes?.rowspan)}
        />
      )
    case 'tableRow':
      return <tr />
  }
}

function headingTag(level: unknown): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  if (level === 2) return 'h2'
  if (level === 3) return 'h3'
  if (level === 4) return 'h4'
  if (level === 5) return 'h5'
  if (level === 6) return 'h6'
  return 'h1'
}

function numberAttribute(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
}

function textAlignAttribute(value: unknown): TextAlign | undefined {
  if (typeof value !== 'string') return
  if (
    value === 'center' ||
    value === 'end' ||
    value === 'justify' ||
    value === 'left' ||
    value === 'match-parent' ||
    value === 'right' ||
    value === 'start'
  )
    return value
}

function isComponentView(
  view: View | undefined
): view is ComponentType<Attributes & {children?: ReactNode}> {
  return Boolean(view) && !isValidElement(view)
}

interface RichTextNodeViewProps {
  views: Record<string, View | undefined>
  node: Node
}

function RichTextNodeView({views, node}: RichTextNodeViewProps) {
  if (Node.isText(node)) {
    const {[TextNode.text]: text, [TextNode.marks]: marks} = node
    const TextView = views.text
    const content: ReactNode =
      typeof TextView === 'function' ? (
        <TextView>{text}</TextView>
      ) : (
        (text ?? '')
      )
    const wrappers = marks?.map(mark => ({
      type: mark[Mark.type],
      element: nodeElement(mark[Mark.type], mark)
    }))
    return (wrappers ?? []).reduce((children, {element}) => {
      if (!element?.type) return children
      const View = views[String(element.type)]
      if (isComponentView(View)) {
        const Component = View
        return <Component {...element.props}>{children}</Component>
      }
      const view = View ?? element
      return (
        <view.type {...element.props} {...(view.props as Attributes)}>
          {children}
        </view.type>
      )
    }, content)
  }
  if (Node.isElement(node)) {
    const {[Node.type]: type, [ElementNode.content]: content, ...attrs} = node
    const element = nodeElement(type, attrs, content)
    const View = element?.type ? views[String(element.type)] : undefined
    const inner =
      content?.map((node: Node, i: number) => (
        <RichTextNodeView key={i} views={views} node={node} />
      )) ?? null
    if (isComponentView(View)) {
      const Component = View
      return (
        <Component {...element?.props}>
          {inner}
        </Component>
      )
    }
    const el = View ?? element ?? {type: Fragment, props: {}}
    return (
      <el.type {...element?.props} {...(el.props as Attributes)}>
        {inner}
      </el.type>
    )
  }
  if (Node.isBlock(node)) {
    const {[Node.type]: type, [BlockNode.id]: id, ...attrs} = node
    const View = views[type]
    if (!isComponentView(View)) return null
    const Component = View
    return <Component {...attrs} />
  }
}

interface RichTextElementViews {
  h1?: ComponentType<JSX.IntrinsicElements['h1']> | ReactElement
  h2?: ComponentType<JSX.IntrinsicElements['h2']> | ReactElement
  h3?: ComponentType<JSX.IntrinsicElements['h3']> | ReactElement
  h4?: ComponentType<JSX.IntrinsicElements['h4']> | ReactElement
  h5?: ComponentType<JSX.IntrinsicElements['h5']> | ReactElement
  h6?: ComponentType<JSX.IntrinsicElements['h6']> | ReactElement
  p?: ComponentType<JSX.IntrinsicElements['p']> | ReactElement
  b?: ComponentType<JSX.IntrinsicElements['b']> | ReactElement
  i?: ComponentType<JSX.IntrinsicElements['i']> | ReactElement
  ul?: ComponentType<JSX.IntrinsicElements['ul']> | ReactElement
  ol?: ComponentType<JSX.IntrinsicElements['ol']> | ReactElement
  li?: ComponentType<JSX.IntrinsicElements['li']> | ReactElement
  blockquote?: ComponentType<JSX.IntrinsicElements['blockquote']> | ReactElement
  hr?: ComponentType<JSX.IntrinsicElements['hr']> | ReactElement
  br?: ComponentType<JSX.IntrinsicElements['br']> | ReactElement
  small?: ComponentType<JSX.IntrinsicElements['small']> | ReactElement
  sub?: ComponentType<JSX.IntrinsicElements['sub']> | ReactElement
  sup?: ComponentType<JSX.IntrinsicElements['sup']> | ReactElement
  a?: ComponentType<JSX.IntrinsicElements['a']> | ReactElement
  table?: ComponentType<JSX.IntrinsicElements['table']> | ReactElement
  tbody?: ComponentType<JSX.IntrinsicElements['tbody']> | ReactElement
  td?: ComponentType<JSX.IntrinsicElements['td']> | ReactElement
  th?: ComponentType<JSX.IntrinsicElements['th']> | ReactElement
  tr?: ComponentType<JSX.IntrinsicElements['tr']> | ReactElement
}

export type RichTextProps<Blocks extends object = {}> =
  RichTextBaseProps<Blocks> &
    RichTextElementViews &
    RichTextBlockViews<Blocks>

type RichTextComponentProps<Blocks extends object> =
  RichTextBaseProps<Blocks> &
    RichTextElementViews &
    RichTextBlockViews<NoInferType<Blocks>>

export function RichText<Blocks extends object = {}>(
  props: RichTextComponentProps<Blocks>
): ReactElement | null
export function RichText<Blocks extends object = {}>({
  doc,
  ...views
}: RichTextProps<Blocks>) {
  if (!Array.isArray(doc)) return null
  return (
    <Fragment>
      {doc.map((node, i) => {
        return (
          <RichTextNodeView
            key={i}
            views={views as Record<string, View | undefined>}
            node={node}
          />
        )
      })}
    </Fragment>
  )
}
