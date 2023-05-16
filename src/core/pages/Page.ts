import {EntryData} from 'alinea/backend/db/EntryData'
import {EntryPhase} from '../Entry.js'
import {Target} from './Target.js'

export interface Page {
  entryId: string
  phase: EntryPhase
  type: string

  workspace: string
  root: string
  filePath: string

  contentHash: string
  modifiedAt: number

  parentDir: string
  childrenDir: string
  parent: string
  index: string | null
  locale: string | null
  i18nId: string | null

  path: string
  title: string
  url: string
  data: EntryData
}

export const Page = Target.create<Page>({})
