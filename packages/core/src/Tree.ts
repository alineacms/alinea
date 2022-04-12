import type {EV} from '@alinea/store'
import {Entry} from './Entry'

export namespace Tree {
  export function siblings(id: EV<string>) {
    const Self = Entry.as('Self')
    return Entry.where(Entry.id.isNot(id)).where(
      Entry.parent.is(Self.where(Self.id.is(id)).select(Self.parent).first())
    )
  }

  export function children(id: EV<string>, depth = 1) {
    if (depth > 1) throw 'todo depth > 1'
    return Entry.where(Entry.parent.is(id)).orderBy(Entry.index.asc())
  }

  export function parents(id: EV<string>) {
    const Self = Entry.as('Self')
    const Parent = Entry.as('Parent')
    return Self.where(Self.id.is(id))
      .innerJoin(Parent, Parent.id.isIn(Self.parents.each()))
      .select(Parent.fields)
  }

  export function parent(id: EV<string>) {
    const Self = Entry.as('Self')
    const Parent = Entry.as('Parent')
    return Self.where(Self.id.is(id))
      .innerJoin(Parent, Parent.id.is(Self.parent))
      .select(Parent.fields)
  }

  export function nextSibling(id: EV<string>) {
    const Self = Entry.as('Self')
    const self = Self.where(Self.id.is(id))
    return Entry.where(Entry.parent.is(self.select(Self.parent).first()))
      .orderBy(Entry.index.asc())
      .where(Entry.index.greater(self.select(Self.index).first()))
      .first()
  }

  export function prevSibling(id: EV<string>) {
    const Self = Entry.as('Self')
    const self = Self.where(Self.id.is(id))
    return Entry.where(Entry.parent.is(self.select(Self.parent).first()))
      .orderBy(Entry.index.desc())
      .where(Entry.index.less(self.select(Self.index).first()))
      .first()
  }
}
