export type TextDoc<T = {}> = Array<Node>

export type Node = TextNode | ElementNode | BlockNode

export namespace Node {
  export const type = '_type' satisfies keyof Node

  export function isText(node: any): node is TextNode {
    return node[type] === 'text'
  }
  export function isElement(node: any): node is ElementNode {
    const typeName = node[type]
    return (
      typeof typeName === 'string' &&
      typeName !== 'text' &&
      typeName[0]?.toLowerCase() === typeName[0]
    )
  }
  export function isBlock(node: any): node is BlockNode {
    const typeName = node[type]
    return (
      typeof typeName === 'string' &&
      typeName !== 'text' &&
      typeName[0]?.toUpperCase() === typeName[0]
    )
  }
}

export interface Mark {
  _type: string
  [attr: string]: string | undefined
}

export namespace Mark {
  export const type = '_type' satisfies keyof Mark
}

export interface LinkMark extends Mark {
  _type: 'link'
  _id: string
  _link: 'entry' | 'file' | 'url'
  _entry?: string
}

export namespace LinkMark {
  export const id = '_id' satisfies keyof LinkMark
  export const link = '_link' satisfies keyof LinkMark
  export const entry = '_entry' satisfies keyof LinkMark
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
