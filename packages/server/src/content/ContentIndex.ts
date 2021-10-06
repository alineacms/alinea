import {Content, Draft, Entry, Outcome} from '@alinea/core'
import {getCachedIndex} from '@alinea/index'
import {Expression, Functions, Store} from 'helder.store'

class Indexed implements Content {
  constructor(protected store: Store) {}

  async get(id: string): Promise<Entry | null> {
    return this.store.first(Entry.where(Entry.$id.is(id)))
  }

  async entryWithDraft(id: string): Promise<Entry.WithDraft | null> {
    const entry = this.store.first(Entry.where(Entry.$id.is(id)))
    const draft = this.store.first(Draft.where(Draft.entry.is(id)))
    return entry && {entry, draft}
  }

  async put(id: string, entry: Entry): Promise<Outcome<void>> {
    // Todo: only update keys that changed?
    return Outcome.attempt(() => {
      this.store.update(Entry.where(Entry.$id.is(id)), entry as any)
    })
  }

  async putDraft(id: string, doc: string): Promise<Outcome<void>> {
    return Outcome.attempt(() => {
      const existing = this.store.first(Draft.where(Draft.entry.is(id)))
      if (existing) this.store.update(Draft, {doc: Expression.value(doc)})
      else this.store.insert(Draft, {entry: id, doc})
    })
  }

  async list(parentId?: string): Promise<Array<Entry.WithChildrenCount>> {
    const Parent = Entry.as('Parent')
    return this.store.all(
      Entry.where(
        parentId ? Entry.$parent.is(parentId) : Entry.$parent.isNull()
      ).select({
        $id: Entry.$id,
        $channel: Entry.$channel,
        $parent: Entry.$parent,
        $isContainer: Entry.$isContainer,
        title: Entry.title,
        childrenCount: Parent.where(Parent.$parent.is(Entry.$id))
          .select(Functions.count())
          .first()
      })
    )
  }
}

export class ContentIndex implements Content {
  index: Promise<Content>

  constructor(protected contentPath: string, protected cacheFile?: string) {
    this.index = getCachedIndex(this.contentPath, this.cacheFile).then(
      store => new Indexed(store)
    )
  }

  get(id: string): Promise<Entry.WithParents | null> {
    return this.index.then(index => index.get(id))
  }

  entryWithDraft(id: string): Promise<Entry.WithDraft | null> {
    return this.index.then(index => index.entryWithDraft(id))
  }

  put(id: string, entry: Entry): Promise<Outcome<void>> {
    return this.index.then(index => index.put(id, entry))
  }

  putDraft(id: string, doc: string): Promise<Outcome<void>> {
    return this.index.then(index => index.putDraft(id, doc))
  }

  list(parentId?: string): Promise<Array<Entry.WithChildrenCount>> {
    return this.index.then(index => index.list(parentId))
  }
}
