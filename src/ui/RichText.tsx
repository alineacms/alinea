import {Infer} from 'alinea/core/Infer'
import {Schema} from 'alinea/core/Schema'
import {
  BlockNode,
  ElementNode,
  Mark,
  Node,
  TextDoc,
  TextNode
} from 'alinea/core/TextDoc'
import {RichTextElements} from 'alinea/core/shape/RichTextShape'
import {slugify} from 'alinea/core/util/Slugs'
import {ComponentType, Fragment, ReactElement, isValidElement} from 'react'

type Element = keyof typeof RichTextElements

function textContent(doc: TextDoc): string {
  return doc.reduce((text, node) => {
    if (Node.isText(node)) return text + node.text
    if ('content' in node && Array.isArray(node.content))
      return text + textContent(node.content)
    return text
  }, '')
}

function nodeElement(
  type: string,
  attributes: Record<string, any> | undefined,
  content?: TextDoc
): ReactElement<any, Element> | undefined {
  const style = {
    textAlign:
      attributes?.textAlign === 'left' ? undefined : attributes?.textAlign
  }
  switch (type) {
    case 'heading':
      const Tag = `h${attributes?.level || 1}` as 'h1'
      const id =
        attributes?.id ?? (content ? slugify(textContent(content)) : undefined)
      return <Tag style={style} id={id} />
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
    case 'link':
      const props = {
        href: attributes?.href,
        target: attributes?.target,
        title: attributes?.title
      }
      return <a {...props} />
  }
}

type RichTextNodeViewProps<T> = {
  views: Record<string, ComponentType<any> | ReactElement>
  node: Node
}

function RichTextNodeView<T>({views, node}: RichTextNodeViewProps<T>) {
  if (Node.isText(node)) {
    const {[TextNode.text]: text, [TextNode.marks]: marks} = node
    const content =
      typeof views.text === 'function' ? <views.text>{text}</views.text> : text
    const wrappers =
      marks?.map(mark => nodeElement(mark[Mark.type], mark)) || []
    return wrappers.reduce((children, element) => {
      if (!element?.type) return <Fragment>{children}</Fragment>
      const View: any = views[element.type]
      if (View && !isValidElement(View)) {
        return <View {...element.props}>{children}</View>
      } else {
        const node = View ?? element
        return (
          <node.type {...element?.props} {...(node.props as object)}>
            {children}
          </node.type>
        )
      }
    }, <Fragment>{content}</Fragment>)
  } else if (Node.isElement(node)) {
    const {[Node.type]: type, [ElementNode.content]: content, ...attrs} = node
    const element = nodeElement(type, attrs, content)
    const View: any = views[element?.type || type]
    const inner =
      content?.map((node, i) => (
        <RichTextNodeView key={i} views={views} node={node} />
      )) || null
    if (View && !isValidElement(View)) {
      return <View {...(element?.props || attrs)}>{inner}</View>
    } else {
      const node = View ?? element ?? {type: Fragment}
      return (
        <node.type {...element?.props} {...(node.props as object)}>
          {inner}
        </node.type>
      )
    }
  } else if (Node.isBlock(node)) {
    const {[Node.type]: type, [BlockNode.id]: id, ...attrs} = node
    const View: any = views[type]
    if (!View) return null
    return <View {...attrs} />
  }
}

export type RichTextProps<Blocks extends Schema> = {
  doc: TextDoc<Blocks>
  text?: ComponentType<{children: string}>
} & {
  [K in keyof typeof RichTextElements]?:
    | ComponentType<JSX.IntrinsicElements[K]>
    | ReactElement
} & {[K in keyof Blocks]?: ComponentType<Infer<Blocks[K]>>}

export function RichText<Blocks extends Schema>({
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
            views={views as Record<string, ComponentType<any> | ReactElement>}
            node={node}
          />
        )
      })}
    </Fragment>
  )
}
