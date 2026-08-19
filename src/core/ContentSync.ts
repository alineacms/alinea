import {type Entry} from './Entry.js'
import type {EntryReference} from './db/EntryReference.js'
import type {PolicyData} from './Role.js'

export interface ContentState {
  version: 1
  revision: string
  configId: string
  policy: PolicyData
  entries: Record<string, string>
}

export interface ContentEntry {
  id: string
  versions: Array<ContentVersion>
}

export interface ContentVersion {
  entry: Entry
  permissions: number
  fieldPermissions: Record<string, number>
  references: Array<EntryReference>
}

export interface ContentStateResponse {
  state: ContentState
  objects: Record<string, ContentEntry>
}

export interface DashboardBootstrap {
  configId: string
  moduleUrl: string
  styleUrl: string
  cacheKey: string
}
