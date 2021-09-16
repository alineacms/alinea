export type Id<T> = string & {__t: T}

export namespace Label {
  export type Data = {[language: string]: string}
}
export interface Label {
  $label: Label.Data
}
export function Label(data: Label.Data) {
  return {$label: data}
}

export interface Entry {
  path: string
  isContainer?: boolean
  title: string
  parent?: string
}

export interface Content {
  get(path: string): Promise<Entry | null>
  list(parent?: string): Promise<Array<Entry>>
}

export interface Hub {
  content: Content
}
