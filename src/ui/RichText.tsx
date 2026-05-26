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
type RichTextBlockViews<Blocks extends object> = {
  [K in keyof Blocks]?: ComponentType<Infer<Blocks[K]>>
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
      const Tag = `h${typeof level === 'number' ? level : 1}` as 'h1'
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
    return (wrappers ?? []).reduce((children, {type, element}) => {
      if (!element?.type) return children
      const View = views[type] ?? views[String(element.type)]
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
    const View = views[type] ?? views[element?.type ? String(element.type) : type]
    const inner =
      content?.map((node: Node, i: number) => (
        <RichTextNodeView key={i} views={views} node={node} />
      )) ?? null
    if (isComponentView(View)) {
      const Component = View
      return (
        <Component {...element?.props} {...attrs}>
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

export interface RichTextProps<Blocks extends object = {}> {
  doc: TextDoc<Blocks>
  text?: ComponentType<{children: string | undefined}>
  heading?: ComponentType<JSX.IntrinsicElements['h1']> | ReactElement
  paragraph?: ComponentType<JSX.IntrinsicElements['p']> | ReactElement
  bold?: ComponentType<JSX.IntrinsicElements['b']> | ReactElement
  italic?: ComponentType<JSX.IntrinsicElements['i']> | ReactElement
  bulletList?: ComponentType<JSX.IntrinsicElements['ul']> | ReactElement
  orderedList?: ComponentType<JSX.IntrinsicElements['ol']> | ReactElement
  listItem?: ComponentType<JSX.IntrinsicElements['li']> | ReactElement
  blockquote?: ComponentType<JSX.IntrinsicElements['blockquote']> | ReactElement
  horizontalRule?: ComponentType<JSX.IntrinsicElements['hr']> | ReactElement
  hardBreak?: ComponentType<JSX.IntrinsicElements['br']> | ReactElement
  small?: ComponentType<JSX.IntrinsicElements['small']> | ReactElement
  subscript?: ComponentType<JSX.IntrinsicElements['sub']> | ReactElement
  superscript?: ComponentType<JSX.IntrinsicElements['sup']> | ReactElement
  link?: ComponentType<JSX.IntrinsicElements['a']> | ReactElement
  table?: ComponentType<JSX.IntrinsicElements['table']> | ReactElement
  tableBody?: ComponentType<JSX.IntrinsicElements['tbody']> | ReactElement
  tableCell?: ComponentType<JSX.IntrinsicElements['td']> | ReactElement
  tableHeader?: ComponentType<JSX.IntrinsicElements['th']> | ReactElement
  tableRow?: ComponentType<JSX.IntrinsicElements['tr']> | ReactElement
}

export function RichText<Blocks extends object = {}>({
  doc,
  ...views
}: RichTextProps<Blocks> & RichTextBlockViews<NoInfer<Blocks>>) {
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
