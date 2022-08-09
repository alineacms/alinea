import {TypesOf} from './Schema'

export namespace TextNode {
  export type Mark = {
    type: string
    attrs?: Record<string, string>
  }
  export type Text = {
    type: 'text'
    text?: string
    marks?: Array<Mark>
  }
  export type Element<T = any> = {
    type:
      | 'paragraph'
      | 'heading'
      | 'bold'
      | 'italic'
      | 'bulletList'
      | 'listItem'
      | TypesOf<T>
    content?: TextDoc<T>
    [key: string]: any
  }
  export function isText(node: any): node is Text {
    return node.type === 'text'
  }
  export function isElement(node: any): node is Element {
    return node.type !== 'text'
  }
}

export type TextNode<T = {}> = TextNode.Text | TextNode.Element<T>

export type TextDoc<T = {}> = Array<TextNode<T>>
