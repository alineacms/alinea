declare const blocks: unique symbol

/**
 * Rich text content. `Blocks` is the schema of the blocks that can appear in
 * the document, so rich text views such as `<RichText />` can infer which
 * block components they accept. It only exists at the type level.
 */
export type TextDoc<Blocks = {}> = Array<Node> & {
  // A method signature keeps documents with different block schemas
  // assignable to each other (method parameters are bivariant)
  [blocks]?(schema: Blocks): void
}

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
  _locale?: string
  _anchor?: string
  _suffix?: string
}

export namespace LinkMark {
  export const id = '_id' satisfies keyof LinkMark
  export const link = '_link' satisfies keyof LinkMark
  export const entry = '_entry' satisfies keyof LinkMark
  export const locale = '_locale' satisfies keyof LinkMark
  export const anchor = '_anchor' satisfies keyof LinkMark
  export const suffix = '_suffix' satisfies keyof LinkMark
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
  marks?: Array<Mark>
  [key: string]: any
}

export namespace ElementNode {
  export const content = 'content' satisfies keyof ElementNode
}

export interface ImageNode extends ElementNode {
  _type: 'image'
  _id?: string
  _link?: 'image'
  _entry?: string
  src?: string
  alt?: string
  title?: string
  width?: number | string
  height?: number | string
}

export interface BlockNode {
  _id: string
  _type: string
}

export namespace BlockNode {
  export const id = '_id' satisfies keyof BlockNode
}
