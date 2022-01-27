import {Content, Entry, outcome, Outcome} from '@alinea/core'
import {Functions, Store} from 'helder.store'
import {Source} from './Source'

export class Backend implements Content {
  constructor(
    protected store: Store,
    protected source: Source //protected drafts: Drafts
  ) {}

  async get(id: string): Promise<Entry.WithParents | null> {
    const {store} = this
    const self = store.first(Entry.where(Entry.id.is(id)))
    if (!self) return null
    function parents(entry: Entry): Array<string> {
      if (!entry.$parent) return []
      const parent = store.first(Entry.where(Entry.id.is(entry.$parent)))
      return parent ? [parent.id, ...parents(parent)] : []
    }
    return {...self, parents: parents(self)}
  }

  /*async entryWithDraft(id: string): Promise<Entry.WithDraft | null> {
    const {store} = this
    const entry = store.first(Entry.where(Entry.id.is(id)))
    if (!entry) return null
    const [update] = await this.drafts.get(id)
    if (update) {
      return {
        entry,
        draft: {
          entry: id,
          doc: encode(update)
        }
      }
    }
    return {entry}
  }*/

  async put(id: string, entry: Entry): Promise<Outcome> {
    const {store} = this
    const query = Entry.where(Entry.id.is(id))
    const existing = store.first(query)
    return outcome(() => {
      if (!existing) store.insert(Entry, entry)
      else store.update(query, entry as any)
    })
  }

  /*async putDraft(id: string, doc: string): Promise<Outcome> {
    return outcome(this.drafts.update(id, new Uint8Array(decode(doc))))
  }*/

  async list(parentId?: string): Promise<Array<Entry.WithChildrenCount>> {
    const {store} = this
    const Parent = Entry.as('Parent')
    return store.all(
      Entry.where(
        parentId ? Entry.$parent.is(parentId) : Entry.$parent.isNull()
      ).select({
        id: Entry.id,
        type: Entry.type,
        title: Entry.title,
        childrenCount: Parent.where(Parent.$parent.is(Entry.id))
          .select(Functions.count())
          .first(),
        $path: Entry.$path,
        $parent: Entry.$parent,
        $isContainer: Entry.$isContainer
      })
    )
  }

  async publish(entries: Array<Entry>): Promise<Outcome<void>> {
    return this.source.publish(entries)
  }
}
