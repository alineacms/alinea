import {EntryRow} from './EntryRow.js'
import {Type} from './Type.js'
import {Cursor} from './pages/Cursor.js'
import {Target} from './pages/Target.js'

export interface Page extends EntryRow {}
export const Page = Target.create<Page>({})

export interface PageSeedData {
  type: Type
  partial: Record<string, any>
}

export type PageSeed<
  Definition = object,
  Children extends Record<string, PageSeed> = Record<string, PageSeed<any, any>>
> = Children & {
  [PageSeed.Data]: PageSeedData
}

export namespace PageSeed {
  export const Data = Symbol.for('@alinea/Page.Data')

  export function data(page: PageSeed): PageSeedData {
    return page[PageSeed.Data]
  }

  export function isPageSeed(page: any): page is PageSeed {
    return Boolean(page && page[PageSeed.Data])
  }
}

export function page<
  Definition,
  Children extends Record<string, PageSeed<any, any>>
>(
  type: Type<Definition> | Cursor.Partial<Definition>,
  children?: Children
): PageSeed<Definition, Children> {
  children = children ?? ({} as Children)
  return {
    ...children,
    [PageSeed.Data]: {
      type: type instanceof Cursor ? type.type : type,
      partial: type instanceof Cursor ? type.partial : {}
    }
  }
}
