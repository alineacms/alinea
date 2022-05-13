import {TextDoc, TextNode, TypesOf} from '@alinea/core'
import {fromModule} from '@alinea/ui'
import {ComponentType, CSSProperties, Fragment, ReactElement} from 'react'
import reactStringReplace from 'react-string-replace'
import css from './RichText.module.scss'

const styles = fromModule(css)

function getElement(
  type: string,
  attributes: Record<string, any> | undefined
): ReactElement | undefined {
  switch (type) {
    case 'heading':
      const Tag = `h${attributes?.level || 1}` as 'h1'
      return <Tag className={styles.heading()} />
    case 'paragraph':
      return (
        <p
          className={styles.paragraph()}
          style={richTextStyles(attributes as RichTextAttributes | undefined)}
        />
      )
    case 'bold':
      return <b />
    case 'italic':
      return <i />
    case 'bulletList':
      return <ul className={styles.list()} />
    case 'orderedList':
      return <ol className={styles.list()} />
    case 'listItem':
      return <li className={styles.listItem()} />
  }
}

type RichTextAttributes = {
  textAlign: 'center' | 'right' | 'justify'
}

function richTextStyles(attrs: RichTextAttributes | undefined): CSSProperties {
  switch (true) {
    case attrs?.textAlign === 'center':
      return {textAlign: 'center'}
    case attrs?.textAlign === 'right':
      return {textAlign: 'right'}
    case attrs?.textAlign === 'justify':
      return {textAlign: 'justify'}
    default:
      return {}
  }
}

function RichTextNodeView<T>(node: TextNode<T>) {
  switch (node.type) {
    case 'text': {
      const {text, marks} = node as TextNode.Text
      const content = reactStringReplace(text, /\`(.+?)\`/g, (match, i) => (
        <span className={styles.code()} key={i}>
          {match}
        </span>
      ))
      const wrappers =
        marks?.map(mark => getElement(mark.type, mark.attrs)) || []
      return wrappers.reduce((children, element) => {
        const Tag = element?.type || Fragment
        return <Tag {...element?.props}>{children}</Tag>
      }, <>{content}</>)
    }
    default: {
      const {type, content, ...attrs} = node as TextNode.Element
      const element = getElement(type, attrs)
      const Tag = element?.type || Fragment
      return (
        <Tag {...element?.props}>
          {content?.map((node, i) => (
            <RichTextNodeView key={i} {...node} />
          )) || <br />}
        </Tag>
      )
    }
  }
}

export type RichTextProps<T> = {
  doc: TextDoc<T>
  view?: Partial<{
    [K in TypesOf<T>]: ComponentType<Extract<T, {type: K}>>
  }>
}

export function RichText<T>({doc, view}: RichTextProps<T>) {
  const custom: Record<string, any> = view || {}
  if (!Array.isArray(doc)) return null
  return (
    <>
      {doc.map((node, i) => {
        const Custom = custom[node.type]
        if (Custom) return <Custom key={i} {...node} />
        return <RichTextNodeView key={i} {...node} />
      })}
    </>
  )
}
