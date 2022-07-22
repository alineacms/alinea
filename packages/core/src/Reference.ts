export interface Reference {
  id: string
  type: string
}

export namespace Reference {
  export interface Entry extends Reference {
    type: 'entry'
    entry: string
  }
  export function isEntry(value: any): value is Entry {
    return value && value.type === 'entry'
  }
  export interface Url extends Reference {
    type: 'url'
    url: string
    description?: string
    target?: '_blank' | '_self'
  }
  export function isUrl(value: any): value is Entry {
    return value && value.type === 'url'
  }
}
