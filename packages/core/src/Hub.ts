export type Id<T> = string & {__t: T}

type LabelData = {[language: string]: string}
export type Label = {$label: {[language: string]: string}}
export function Label(data: LabelData) {
  return {$label: data}
}

export type Entry = {
  id: Id<Entry>
  title: Label
}

export interface Content {
  list(): Promise<Array<Entry>>
}

export interface Hub {
  content: Content
}
