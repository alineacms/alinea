import {Content, Draft, Entry, Outcome} from '@alinea/core'
import {Expression, Functions} from 'helder.store'
import {Persistence} from '../Persistence'
import {Cache} from './cache/Cache'

export class IndexedContent implements Content {
  constructor(protected cache: Cache, protected persistence: Persistence) {}

  async get(id: string): Promise<Entry.WithParents | null> {
    const store = await this.cache.store
    const self = store.first(Entry.where(Entry.id.is(id)))
    if (!self) return null
    function parents(entry: Entry): Array<string> {
      if (!entry.$parent) return []
      const parent = store.first(Entry.where(Entry.id.is(entry.$parent)))
      return parent ? [parent.id, ...parents(parent)] : []
    }
    return {...self, parents: parents(self)}
  }

  async entryWithDraft(id: string): Promise<Entry.WithDraft | null> {
    const store = await this.cache.store
    const entry = store.first(Entry.where(Entry.id.is(id)))
    const draft = store.first(Draft.where(Draft.entry.is(id)))
    return entry && {entry, draft}
  }

  async put(id: string, entry: Entry): Promise<Outcome<void>> {
    const store = await this.cache.store
    const query = Entry.where(Entry.id.is(id))
    const existing = store.first(query)
    return Outcome.attempt(() => {
      if (!existing) store.insert(Entry, entry)
      else store.update(query, entry as any)
    })
  }

  async putDraft(id: string, doc: string): Promise<Outcome<void>> {
    const store = await this.cache.store
    return Outcome.attempt(() => {
      const query = Draft.where(Draft.entry.is(id))
      const existing = store.first(query)
      if (existing) store.update(query, {doc: Expression.value(doc)})
      else store.insert(Draft, {entry: id, doc})
    })
  }

  async list(parentId?: string): Promise<Array<Entry.WithChildrenCount>> {
    const store = await this.cache.store
    const Parent = Entry.as('Parent')
    return store.all(
      Entry.where(
        parentId ? Entry.$parent.is(parentId) : Entry.$parent.isNull()
      ).select({
        id: Entry.id,
        $path: Entry.$path,
        type: Entry.type,
        $parent: Entry.$parent,
        $isContainer: Entry.$isContainer,
        title: Entry.title,
        childrenCount: Parent.where(Parent.$parent.is(Entry.id))
          .select(Functions.count())
          .first()
      })
    )
  }

  async publish(entries: Array<Entry>): Promise<Outcome<void>> {
    return this.persistence.persist(entries)
  }
}
