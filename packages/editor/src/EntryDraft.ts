import {
  docFromEntry,
  Draft,
  Entry,
  EntryStatus,
  Label,
  Outcome,
  Type,
  Value
} from '@alinea/core'
import {InputPath} from '@alinea/editor'
import {fromUint8Array, toUint8Array} from 'js-base64'
import {Observable} from 'lib0/observable'
import {Room, WebrtcProvider} from 'y-webrtc'
import * as Y from 'yjs'

const ROOT_KEY = 'root'

type Parent = Y.Map<any>

export enum EntryDraftStatus {
  Synced,
  Saving,
  Pending
}

export enum PublishStatus {
  Published,
  Draft
}

export class EntryDraft
  extends Observable<'status' | 'change'>
  implements Entry
{
  public doc: Y.Doc
  private root: Y.Map<any>
  private saveTimeout: any = null

  constructor(
    private channel: Type,
    private entry: Entry,
    draft: Draft | null,
    protected saveDraft: (doc: string) => Promise<Outcome<void>>
  ) {
    super()
    this.doc = new Y.Doc()
    if (draft?.doc) Y.applyUpdate(this.doc, toUint8Array(draft.doc))
    else docFromEntry(channel, entry, this.doc)
    this.root = this.doc.getMap(ROOT_KEY)
  }

  connect() {
    const provider = new WebrtcProvider('@alinea/entry-' + this.id, this.doc)
    const save = () => {
      this.saveTimeout = null
      this.emit('status', [EntryDraftStatus.Saving])
      this.saveDraft(fromUint8Array(Y.encodeStateAsUpdate(this.doc))).then(
        () => {
          if (this.saveTimeout === null)
            this.emit('status', [EntryDraftStatus.Synced])
        }
      )
    }
    const watch = (
      update?: Uint8Array,
      origin?: Room | undefined,
      doc?: Y.Doc,
      transaction?: Y.Transaction
    ) => {
      this.emit('change', [])
      if (this.$status === EntryStatus.Published)
        this.root.set('$status', EntryStatus.Draft)
      // This update did not originate from us
      if (origin instanceof Room) return
      this.emit('status', [EntryDraftStatus.Pending])
      clearTimeout(this.saveTimeout)
      this.saveTimeout = setTimeout(save, 3000)
    }
    this.doc.on('update', watch)
    return () => {
      this.doc.off('update', watch)
      provider.destroy()
      if (this.saveTimeout) save()
    }
  }

  getEntry(): Entry {
    return {
      id: this.id,
      $path: this.$path,
      type: this.type,
      title: this.title,
      ...this.channel.valueType.fromY(this.root)
    }
  }

  watchStatus(fun: (status: EntryDraftStatus) => void) {
    this.on('status', fun)
    return () => this.off('status', fun)
  }

  watchChanges(fun: () => void) {
    this.on('change', fun)
    return () => this.off('change', fun)
  }

  static get $path() {
    return new InputPath.EntryProperty<string>(['$path'])
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
    return this.root.get('id') || this.entry.id
  }

  get $path(): string {
    return this.root.get('$path') || this.entry.$path
  }

  get type(): string {
    return this.root.get('type') || this.entry.type
  }

  get $status(): EntryStatus {
    return (
      this.root.get('$status') || this.entry.$status || EntryStatus.Published
    )
  }

  get title(): Label {
    return this.root.get('title') || this.entry.title
  }

  getLocation(location: Array<string>) {
    let target = this.root
    let parent = target
    let type: Value = this.channel.valueType
    for (const key of location) {
      parent = target
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
