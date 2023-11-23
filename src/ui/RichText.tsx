import {Infer, Schema, TextDoc, TextNode} from 'alinea/core'
import {ComponentType, Fragment, ReactElement, isValidElement} from 'react'

export enum Elements {
  h1 = 'h1',
  h2 = 'h2',
  h3 = 'h3',
  h4 = 'h4',
  h5 = 'h5',
  h6 = 'h6',
  p = 'p',
  b = 'b',
  i = 'i',
  ul = 'ul',
  ol = 'ol',
  li = 'li',
  a = 'a',
  hr = 'hr',
  br = 'br',
  small = 'small'
}

type Element = keyof typeof Elements

function nodeElement(
  type: string,
  attributes: Record<string, any> | undefined
): ReactElement<any, Element> | undefined {
  const style = {
    textAlign:
      attributes?.textAlign === 'left' ? undefined : attributes?.textAlign
  }
  switch (type) {
    case 'heading':
      const Tag = `h${attributes?.level || 1}` as 'h1'
      return <Tag style={style} />
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
    case 'link':
      return <a {...attributes} />
  }
}

type RichTextNodeViewProps<T> = {
  views: Record<string, ComponentType<any> | ReactElement>
  node: TextNode<T>
}

function RichTextNodeView<T>({views, node}: RichTextNodeViewProps<T>) {
  switch (node.type) {
    case 'text': {
      const {text, marks} = node as TextNode.Text
      const content =
        typeof views.text === 'function' ? (
          <views.text>{text}</views.text>
        ) : (
          text
        )
      const wrappers =
        marks?.map(mark => nodeElement(mark.type, mark.attrs)) || []
      return wrappers.reduce((children, element) => {
        if (!element?.type) return <>{children}</>
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
      }, <>{content}</>)
    }
    default: {
      const {type, content, ...attrs} = node as TextNode.Element
      const element = nodeElement(type, attrs)
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
    }
  }
}

export type RichTextProps<Blocks extends Schema> = {
  doc: TextDoc<Blocks>
  text?: ComponentType<{children: string}>
} & {
  [K in keyof typeof Elements]?:
    | ComponentType<JSX.IntrinsicElements[K]>
    | ReactElement
} & {[K in keyof Blocks]?: ComponentType<Infer<Blocks[K]>>}

export function RichText<Blocks extends Schema>({
  doc,
  ...views
}: RichTextProps<Blocks>) {
  if (!Array.isArray(doc)) return null
  return (
    <>
      {doc.map((node, i) => {
        return (
          <RichTextNodeView
            key={i}
            views={views as Record<string, ComponentType<any> | ReactElement>}
            node={node}
          />
        )
      })}
    </>
  )
}
