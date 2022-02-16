import {RichTextNode, TextDoc, TypesOf} from '@alinea/core'
import {ComponentType, Fragment} from 'react'

function getTag(type: string, attributes: Record<string, any> | undefined) {
  switch (type) {
    case 'heading':
      return `h${attributes?.level || 1}`
    case 'bold':
      return 'b'
    case 'italic':
      return 'i'
    case 'paragraph':
      return 'p'
    case 'bulletList':
      return 'ul'
    case 'listItem':
      return 'li'
  }
}

function RichTextNodeView<T>(node: RichTextNode<T>) {
  switch (node.type) {
    case 'text':
      const {text, marks} = node as RichTextNode.Text
      const wrappers =
        marks?.map(mark => getTag(mark.type, mark.attrs) || Fragment) || []
      return wrappers.reduce((children, Tag) => {
        return <Tag>{children}</Tag>
      }, <>{text}</>)
    default:
      const {type, attrs, content} = node as RichTextNode.Element
      const Tag = getTag(type, attrs) || Fragment
      return (
        <Tag>
          {content?.map((node, i) => (
            <RichTextNodeView key={i} {...node} />
          )) || <br />}
        </Tag>
      )
  }
}

type RichTextProps<T> = {
  doc: TextDoc<T>
  view?: Partial<{
    [K in TypesOf<T>]: ComponentType<Extract<T, {type: K}>>
  }>
}

export function RichText<T>({doc, view}: RichTextProps<T>) {
  const custom: Record<string, any> = view || {}
  if (!doc || !doc.content) return null
  return (
    <>
      {doc.content.map((node, i) => {
        const Custom = custom[node.type]
        if (Custom) {
          const id = (node as RichTextNode.Element).attrs?.id
          if (!doc.blocks?.[id]) return null
          return <Custom key={i} {...doc.blocks[id]} />
        }
        return <RichTextNodeView key={i} {...node} />
      })}
    </>
  )
}
