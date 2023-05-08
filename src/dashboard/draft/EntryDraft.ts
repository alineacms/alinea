import {
  Connection,
  Entry,
  EntryMeta,
  EntryStatus,
  Label,
  ROOT_KEY,
  Shape,
  Type,
  docFromEntry,
  entryFromDoc
} from 'alinea/core'
import {Observable, observable} from 'alinea/ui'
import * as Y from 'yjs'
import {EntryProperty} from './EntryProperty.js'

export enum PublishStatus {
  Published,
  Draft
}

export class EntryDraft implements Entry {
  public entry: Observable.Writable<Entry>
  public status: Observable.Writable<EntryStatus>
  private __root: Y.Map<any>

  constructor(
    protected cnx: Connection,
    public channel: Type,
    public detail: Entry.Detail,
    public doc: Y.Doc
  ) {
    this.__root = doc.getMap(ROOT_KEY)
    this.entry = observable(this.getEntry())
    this.status = observable(this.alinea.status)
  }

  get source() {
    return this.detail.entry
  }

  discard() {
    docFromEntry(this.detail.entry, () => this.channel, this.doc)
  }

  connect() {
    const watch = () => {
      if (this.status() === EntryStatus.Published)
        this.status(EntryStatus.Draft)
      this.entry(this.getEntry())
    }
    this.doc.on('update', watch)
    return () => {
      this.doc.off('update', watch)
    }
  }

  getEntry(): Entry {
    return entryFromDoc(this.doc, () => this.channel)
  }

  static get title() {
    return new EntryProperty<string, (state: string) => string>(['title'])
  }

  get id() {
    return this.source.id
  }
  get type() {
    return this.source.type
  }
  get url() {
    return this.source.url
  }
  get alinea() {
    const meta = this.source.alinea
    const draftMeta = this.__root.get('alinea') as EntryMeta
    return {
      ...meta,
      isContainer: draftMeta.isContainer || meta.isContainer,
      index: draftMeta.index || meta.index,
      status: meta.status || EntryStatus.Published,
      parent: draftMeta.parent || meta.parent
    }
  }

  get title(): Label {
    return this.__root.get('title') || this.source.title
  }

  get path(): string {
    return this.__root.get('path') || this.source.path
  }

  translation(locale: string): Entry.Minimal | undefined {
    return this.detail.translations?.find(t => t.alinea.i18n?.locale === locale)
  }

  private getLocation(location: Array<string>) {
    let target = this.__root
    let parent = target
    let shape: Shape = Type.shape(this.channel)
    for (const key of location) {
      parent = target
      if (!target) break
      shape = shape.typeOfChild(target, key)
      target = target.get(key)
    }
    return {shape, parent, target}
  }

  getInput<V, M>(location: Array<string>) {
    const key = location[location.length - 1]
    const {shape, parent} = this.getLocation(location)
    if (!shape) console.log({location, parent, key, shape})
    return {
      mutator: shape.mutator(parent, key) as M,
      get value(): V {
        return shape.fromY(parent.get(key))
      },
      observe: shape.watch(parent, key)
    }
  }
}
