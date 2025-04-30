import type {FieldsDefinition, Type} from './Type.js'

export interface PageData {
  type: Type
  fields: Record<string, any>
}

export type Page<
  Children extends Record<string, Page> = Record<string, never>
> = Children & {
  [Page.Data]: PageData
}

export namespace Page {
  export const Data = Symbol.for('@alinea/Page.Data')

  export function data(page: Page): PageData {
    return page[Page.Data]
  }

  export function isPage(page: any): page is Page {
    return Boolean(page?.[Page.Data])
  }
}

export interface PageConfig<Definition, Children> {
  type: Type<Definition>
  fields?: Partial<Type.Infer<Definition>>
  children?: Children
}

export function page<
  Fields extends FieldsDefinition,
  Children extends Record<string, Page>
>(config: PageConfig<Fields, Children>): Page<Children> {
  return {
    ...config.children,
    [Page.Data]: config
  } as any
}
