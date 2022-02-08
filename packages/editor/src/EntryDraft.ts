import {
  Entry,
  entryFromDoc,
  EntryStatus,
  Hub,
  Label,
  Type,
  Value
} from '@alinea/core'
import {InputPath} from '@alinea/editor'
import {observable, Observable} from '@alinea/ui'
import * as Y from 'yjs'

const ROOT_KEY = 'root'

export enum PublishStatus {
  Published,
  Draft
}

export class EntryDraft implements Entry {
  public entry: Observable<Entry>
  public status: Observable<EntryStatus>
  #root: Y.Map<any>

  constructor(
    protected hub: Hub,
    public channel: Type,
    protected source: Entry,
    public parents: Array<string>,
    public doc: Y.Doc
  ) {
    this.#root = doc.getMap(ROOT_KEY)
    this.entry = observable(this.getEntry())
    this.status = observable(this.$status)
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
    return entryFromDoc(this.channel, this.doc)
  }

  static get url() {
    return new InputPath.EntryProperty<string>(['url'])
  }
  static get type() {
    return new InputPath.EntryProperty<string>(['type'])
  }
  static get $status() {
    return new InputPath.EntryProperty<EntryStatus | undefined>(['$status'])
  }
  static get title() {
    return new InputPath.EntryProperty<string>(['title'])
  }

  get id(): string {
    return this.#root.get('id') || this.source.id
  }

  get workspace(): string {
    return this.#root.get('workspace') || this.source.workspace
  }

  get root(): string {
    return this.#root.get('root') || this.source.root
  }

  get type(): string {
    return this.#root.get('type') || this.source.type
  }

  get url(): string {
    return this.#root.get('url') || this.source.url
  }

  get $status(): EntryStatus {
    return (
      this.#root.get('$status') || this.source.$status || EntryStatus.Published
    )
  }

  get $parent(): string | undefined {
    return this.#root.get('$parent') || this.source.$parent
  }

  get title(): Label {
    return this.#root.get('title') || this.source.title
  }

  getLocation(location: Array<string>) {
    let target = this.#root
    let parent = target
    let type: Value = this.channel.valueType
    for (const key of location) {
      parent = target
      if (!target) break
      type = type.typeOfChild(target, key)
      target = target.get(key)
    }
    return {type, parent, target}
  }

  getInput<T>(location: Array<string>) {
    const key = location[location.length - 1]
    const {type, parent} = this.getLocation(location)
    return {
      mutator: type.mutator(parent, key),
      get value(): T {
        return type.fromY(parent.get(key))
      },
      observe: type.watch(parent, key)
    }
  }
}
