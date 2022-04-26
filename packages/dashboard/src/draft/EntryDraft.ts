import {
  Entry,
  entryFromDoc,
  EntryStatus,
  Hub,
  Label,
  ROOT_KEY,
  Type,
  Value
} from '@alinea/core'
import {observable, Observable} from '@alinea/ui'
import * as Y from 'yjs'
import {EntryProperty} from './EntryProperty'

export enum PublishStatus {
  Published,
  Draft
}

export class EntryDraft implements Entry {
  public entry: Observable<Entry>
  public status: Observable<EntryStatus>
  private __root: Y.Map<any>

  constructor(
    protected hub: Hub,
    public channel: Type,
    protected source: Entry,
    public doc: Y.Doc,
    public previewToken: string,
    public parentData?: Entry.Minimal
  ) {
    this.__root = doc.getMap(ROOT_KEY)
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
    return entryFromDoc(this.doc, () => this.channel)
  }

  static get url() {
    return new EntryProperty<string, (state: string) => string>(['url'])
  }
  static get type() {
    return new EntryProperty<string, (state: string) => string>(['type'])
  }
  static get $status() {
    return new EntryProperty<
      EntryStatus | undefined,
      (status: EntryStatus | undefined) => void
    >(['$status'])
  }
  static get title() {
    return new EntryProperty<string, (state: string) => string>(['title'])
  }

  get id(): string {
    return this.__root.get('id') || this.source.id
  }
  get $isContainer(): boolean | undefined {
    return this.__root.get('$isContainer') || this.source.$isContainer
  }

  get workspace(): string {
    return this.__root.get('workspace') || this.source.workspace
  }

  get root(): string {
    return this.__root.get('root') || this.source.root
  }

  get parents(): Array<string> {
    return this.__root.get('parents') || this.source.parents
  }

  get type(): string {
    return this.__root.get('type') || this.source.type
  }

  get index(): string {
    return this.__root.get('index') || this.source.index
  }

  get url(): string {
    return this.__root.get('url') || this.source.url
  }

  get path(): string {
    return this.__root.get('path') || this.source.path
  }

  get $status(): EntryStatus {
    return (
      this.__root.get('$status') || this.source.$status || EntryStatus.Published
    )
  }

  get parent(): string | undefined {
    return this.__root.get('parent') || this.source.parent
  }

  get title(): Label {
    return this.__root.get('title') || this.source.title
  }

  private getLocation(location: Array<string>) {
    let target = this.__root
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

  getInput<V, M>(location: Array<string>) {
    const key = location[location.length - 1]
    const {type, parent} = this.getLocation(location)
    return {
      mutator: type.mutator(parent, key) as M,
      get value(): V {
        return type.fromY(parent.get(key))
      },
      observe: type.watch(parent, key)
    }
  }
}
