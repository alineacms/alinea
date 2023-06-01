import {Entry} from './Entry.js'
import {Type} from './Type.js'
import {Cursor} from './pages/Cursor.js'
import {Target} from './pages/Target.js'

export interface Page extends Entry {}
export const Page = Target.create<Page>({})

export class PageSeed<Definition = {}, Children = {}> {
  constructor(
    public type: Type<Definition> | Cursor.Find<Type.Row<Definition>>,
    public children: Children
  ) {}
}

export function page<
  Definition,
  Children extends Record<string, PageSeed<any, any>> = {}
>(
  type: Type<Definition> | Cursor.Find<Type.Row<Definition>>,
  children?: Children
): PageSeed<Definition, Children> {
  return new PageSeed(type, (children || {}) as Children)
}
