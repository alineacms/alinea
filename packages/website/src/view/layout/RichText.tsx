import {ElementNode, TextDoc, TextNode} from '@alinea/core'
import {Fragment} from 'react'

const tags: Record<string, any> = {
  heading: 'h1',
  bold: 'b',
  paragraph: 'p'
}

function RichTextNode(node: TextNode | ElementNode) {
  switch (node.type) {
    case 'text':
      const {text, marks} = node as TextNode
      const wrappers = marks?.map(mark => tags[mark.type] || Fragment) || []
      return wrappers.reduce((children, Tag) => {
        return <Tag>{children}</Tag>
      }, text)
    default:
      const {type, content} = node as ElementNode
      const Tag = tags[type] || Fragment
      return (
        <Tag>
          {content?.map((node, i) => <RichTextNode key={i} {...node} />) || (
            <br />
          )}
        </Tag>
      )
  }
}

export function RichText({content}: TextDoc) {
  return (
    <>
      {content.map((node, i) => {
        return <RichTextNode key={i} {...node} />
      })}
    </>
  )
}
