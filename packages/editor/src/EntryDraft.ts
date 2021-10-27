import {
  docFromEntry,
  Draft,
  Entry,
  EntryStatus,
  inputPath,
  InputPath,
  Outcome,
  Type,
  Value
} from '@alinea/core'
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
    private $channel: Type,
    private entry: Entry,
    draft: Draft | null,
    protected saveDraft: (doc: string) => Promise<Outcome<void>>
  ) {
    super()
    this.doc = new Y.Doc()
    if (draft?.doc) Y.applyUpdate(this.doc, toUint8Array(draft.doc))
    else docFromEntry($channel, entry, this.doc)
    this.root = this.doc.getMap(ROOT_KEY)
  }

  connect() {
    const provider = new WebrtcProvider('alinea-' + this.id, this.doc)
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
      provider.destroy()
      this.doc.off('update', watch)
      if (this.saveTimeout) save()
    }
  }

  getEntry(): Entry {
    return {
      id: this.id,
      $path: this.$path,
      $channel: this.$channel,
      title: this.title,
      ...this.$channel.valueType.fromY(this.root)
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

  static $path = inputPath<string>(Value.Scalar, ['$path'])
  static $channel = inputPath<string>(Value.Scalar, ['$channel'])
  static $status = inputPath<EntryStatus | undefined>(Value.Scalar, ['$status'])
  static title = inputPath<string>(Value.Scalar, ['title'])

  get id() {
    return this.root.get('id') || this.entry.id
  }

  get $path() {
    return this.root.get('$path') || this.entry.$path
  }

  get $channel() {
    return this.root.get('$channel') || this.entry.$channel
  }

  get $status() {
    return (
      this.root.get('$status') || this.entry.$status || EntryStatus.Published
    )
  }

  get title() {
    return this.root.get('title') || this.entry.title
  }

  get(target: Y.Map<any>, path: Array<string>): Parent {
    if (path.length === 0) return target as Parent
    return this.get(target.get(path[0]), path.slice(1))
  }

  getParent(location: Array<string>): Parent {
    return this.get(this.root, location.slice(0, -1))
  }

  getInput<T>(path: InputPath<T>) {
    const key = path.location[path.location.length - 1]
    const parent = this.getParent(path.location)
    return {
      mutator: path.type.mutator(parent, key),
      get value(): T {
        return path.type.fromY(parent.get(key))
      },
      observe: path.type.watch(parent, key)
    }
  }
}
