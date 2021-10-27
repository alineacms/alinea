import {Content, Draft, Entry, Outcome} from '@alinea/core'
import {ContentIndex} from '@alinea/index'
import {Expression, Functions} from 'helder.store'
import {Persistence} from '../Persistence'

export class IndexedContent implements Content {
  constructor(
    protected index: ContentIndex,
    protected persistence: Persistence
  ) {}

  async get(id: string): Promise<Entry | null> {
    const store = await this.index.store
    return store.first(Entry.where(Entry.id.is(id)))
  }

  async entryWithDraft(id: string): Promise<Entry.WithDraft | null> {
    const store = await this.index.store
    const entry = store.first(Entry.where(Entry.id.is(id)))
    const draft = store.first(Draft.where(Draft.entry.is(id)))
    return entry && {entry, draft}
  }

  async put(id: string, entry: Entry): Promise<Outcome<void>> {
    const store = await this.index.store
    // Todo: only update keys that changed?
    return Outcome.attempt(() => {
      store.update(Entry.where(Entry.id.is(id)), entry as any)
    })
  }

  async putDraft(id: string, doc: string): Promise<Outcome<void>> {
    const store = await this.index.store
    return Outcome.attempt(() => {
      const existing = store.first(Draft.where(Draft.entry.is(id)))
      if (existing) store.update(Draft, {doc: Expression.value(doc)})
      else store.insert(Draft, {entry: id, doc})
    })
  }

  async list(parentId?: string): Promise<Array<Entry.WithChildrenCount>> {
    const store = await this.index.store
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
    return this.persistence.publish(entries)
  }
}
