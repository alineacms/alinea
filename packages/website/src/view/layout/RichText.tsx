import {ElementNode, TextDoc, TextNode} from '@alinea/core'

const tags = {
  heading: 'h1',
  bold: 'b'
}

function RichTextNode(node: TextNode | ElementNode) {
  switch (node.type) {
    case 'text':
      const {text} = node as TextNode
      return <span>{text}</span>
    default:
      const {type, content} = node as ElementNode
      if (!content) return null
      const Tag = tags[type] || Fragment
      return (
        <Tag>
          {content.map((node, i) => (
            <RichTextNode key={i} {...node} />
          ))}
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
