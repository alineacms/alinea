import {Type} from './Type.js'

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
  type: Type<Definition>,
  partial: Partial<Type.Infer<Definition>> = {},
  children?: Children
): PageSeed<Definition> {
  children = children ?? ({} as Children)
  return {
    ...children,
    [PageSeed.Data]: {
      type: type,
      partial: partial
    }
  }
}
