export interface EntryManifest {
  version: 1
  workspaces: Record<string, EntryManifestWorkspace>
  types: Record<string, EntryManifestType>
}

export interface EntryManifestWorkspace {
  roots: Record<string, EntryManifestRoot>
  mediaDir?: string
}

export interface EntryManifestRoot {
  i18n?: EntryManifestI18n
  contains?: Array<string>
}

export interface EntryManifestI18n {
  locales: Array<string>
}

export interface EntryManifestType {
  contains?: Array<string>
  sharedFields: Array<string>
  searchFields?: Array<string>
  insertOrder?: 'first' | 'last' | 'free'
}
