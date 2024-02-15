export type TextDoc<T = {}> = Array<Node>

export type Node = TextNode | ElementNode | BlockNode

export namespace Node {
  export const type = '_type' satisfies keyof Node

  export function isText(node: any): node is TextNode {
    return node[type] === 'text'
  }
  export function isElement(node: any): node is ElementNode {
    return (
      node[type] !== 'text' && node[type][0]?.toLowerCase() === node[type][0]
    )
  }
  export function isBlock(node: any): node is BlockNode {
    return (
      node[type] !== 'text' && node[type][0]?.toUpperCase() === node[type][0]
    )
  }
}

export interface Mark {
  _type: string
  attrs?: Record<string, string>
}

export namespace Mark {
  export const type = '_type' satisfies keyof Mark
  export const attrs = 'attrs' satisfies keyof Mark
}

export interface TextNode {
  _type: 'text'
  text?: string
  marks?: Array<Mark>
}

export namespace TextNode {
  export const text = 'text' satisfies keyof TextNode
  export const marks = 'marks' satisfies keyof TextNode
}

export interface ElementNode {
  _type: string
  content?: TextDoc
  [key: string]: any
}

export namespace ElementNode {
  export const content = 'content' satisfies keyof ElementNode
}

export interface BlockNode {
  _id: string
  _type: string
}

export namespace BlockNode {
  export const id = '_id' satisfies keyof BlockNode
}
