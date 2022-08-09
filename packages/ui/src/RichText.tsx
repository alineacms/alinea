import {HasType, TextDoc, TextNode, TypesOf} from '@alinea/core'
import {ComponentType, Fragment, isValidElement, ReactElement} from 'react'

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
        const View = views[element.type]
        if (View && !isValidElement(View)) {
          return <View {...element.props}>{children}</View>
        } else {
          const node = View ?? element
          return (
            <node.type {...element?.props} {...node.props}>
              {children}
            </node.type>
          )
        }
      }, <>{content}</>)
    }
    default: {
      const {type, content, ...attrs} = node as TextNode.Element
      const element = nodeElement(type, attrs)
      const View = views[element?.type || type]
      const inner =
        content?.map((node, i) => (
          <RichTextNodeView key={i} views={views} node={node} />
        )) || null
      if (View && !isValidElement(View)) {
        return <View {...(element?.props || attrs)}>{inner}</View>
      } else {
        const node = View ?? element ?? {type: Fragment}
        return (
          <node.type {...element?.props} {...node.props}>
            {inner}
          </node.type>
        )
      }
    }
  }
}

export type RichTextProps<T> = {
  doc: TextDoc<T>
  text?: ComponentType<{children: string}>
} & {
  [K in keyof typeof Elements]?:
    | ComponentType<JSX.IntrinsicElements[K]>
    | ReactElement
} & (T extends HasType
    ? {[K in TypesOf<T>]?: ComponentType<Extract<T, {type: K}>>}
    : {})

export function RichText<T>({doc, ...views}: RichTextProps<T>) {
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
