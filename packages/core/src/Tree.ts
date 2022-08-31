import type {EV} from '@alinea/store'
import {Entry} from './Entry'

export namespace Tree {
  export function siblings(id: EV<string>) {
    const Self = Entry.as('Self')
    return Entry.where(Entry.id.isNot(id)).where(
      Entry.alinea.parent.is(
        Self.where(Self.id.is(id)).select(Self.alinea.parent).first()
      )
    )
  }

  export function children(id: EV<string>, depth = 1) {
    if (depth > 1) throw 'todo depth > 1'
    return Entry.where(Entry.alinea.parent.is(id)).orderBy(
      Entry.alinea.index.asc()
    )
  }

  export function parents(id: EV<string>) {
    const Self = Entry.as('Self')
    const Parent = Entry.as('Parent')
    const parentIds = Self.alinea.parents.each()
    const parentId = parentIds.fields.toExpr()
    return Self.where(Self.id.is(id))
      .select(
        parentIds
          .innerJoin(Parent, Parent.id.is(parentId))
          .select(Parent.fields)
      )
      .first()
      .toExpr()
      .each()
  }

  export function parent(id: EV<string>) {
    const Self = Entry.as('Self')
    const Parent = Entry.as('Parent')
    return Self.where(Self.id.is(id))
      .innerJoin(Parent, Parent.id.is(Self.alinea.parent))
      .select(Parent.fields)
  }

  export function nextSibling(id: EV<string>) {
    const Self = Entry.as('Self')
    const self = Self.where(Self.id.is(id))
    return Entry.where(
      Entry.alinea.parent.is(self.select(Self.alinea.parent).first())
    )
      .orderBy(Entry.alinea.index.asc())
      .where(Entry.alinea.index.greater(self.select(Self.alinea.index).first()))
      .first()
  }

  export function prevSibling(id: EV<string>) {
    const Self = Entry.as('Self')
    const self = Self.where(Self.id.is(id))
    return Entry.where(
      Entry.alinea.parent.is(self.select(Self.alinea.parent).first())
    )
      .orderBy(Entry.alinea.index.desc())
      .where(Entry.alinea.index.less(self.select(Self.alinea.index).first()))
      .first()
  }
}
