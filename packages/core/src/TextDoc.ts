export namespace TextNode {
  export type Mark = {type: string; attrs?: Record<string, string>}
  export type Text = {
    type: 'text'
    text?: string
    marks?: Array<Mark>
  }
  export type Element<T = any> = {
    type: T extends {type: string} ? T['type'] : string
    content?: Array<TextNode<T>>
    [key: string]: any
  }
}

export type TextNode<T = any> = TextNode.Text | TextNode.Element<T>

export type TextDoc<T> = Array<TextNode<T>>
