import {Target} from './Target.js'

export interface Page {
  id: string
  workspace: string
  root: string
  filePath: string

  contentHash: string
  modifiedAt: number

  entryId: string
  type: string

  parentDir: string
  childrenDir: string
  parent: string
  index: string | null
  locale: string | null
  i18nId: string | null

  path: string
  title: string
  url: string
  data: Record<string, any>
}

export const Page = Target.create<Page>({})
