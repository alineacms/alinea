export type TextBlock<T> = {
  id: string
  type: string
} & T

export namespace TextNode {
  export type Mark = {type: string; attrs?: Record<string, string>}
  export type Text = {
    type: 'text'
    text?: string
    marks?: Array<Mark>
  }
  export type Element<T = any> = {
    type: T extends {type: string} ? T['type'] : string
    attrs?: Record<string, any>
    content?: Array<TextNode>
  }
}

export type TextNode<T = any> = TextNode.Text | TextNode.Element<T>

export type TextDoc<T> = {
  type: 'doc'
  blocks: Record<string, TextBlock<T>>
  content: Array<TextNode<T>>
}
