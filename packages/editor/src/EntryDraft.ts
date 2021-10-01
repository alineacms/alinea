import {Entry, InputPath} from '@alinea/core'
import {Value} from '@alinea/core/value/Value'
import {WebsocketProvider} from 'y-websocket'
import * as Y from 'yjs'

const ROOT_KEY = 'root'

type Parent = Y.Map<any>

export class EntryDraft implements Entry {
  public doc: Y.Doc
  private provider: WebsocketProvider

  constructor(public path: string) {
    this.doc = new Y.Doc()
    this.provider = new WebsocketProvider(
      `ws://${window.location.hostname}:4500`,
      this.path,
      this.doc
    )
  }

  destroy() {
    this.provider.destroy()
  }

  private get root() {
    return this.doc.getMap(ROOT_KEY)
  }

  get $id() {
    return this.root.get('$id')
  }

  get $channel() {
    return this.root.get('$channel')
  }

  get title() {
    return this.root.get('title')
  }

  get(target: Y.Map<any>, path: Array<string>): Parent {
    if (path.length === 0) return target as Parent
    return this.get(target.get(path[0]), path.slice(1))
  }

  getParent<T>(path: InputPath<T>): Parent {
    return this.get(this.root, path.slice(0, -1))
  }

  getInput<T>(path: InputPath<T>, type: Value) {
    const key = path[path.length - 1]
    const parent = this.getParent(path)
    const mutator = Value.mutator(type, parent, key)
    return {
      mutator,
      get value(): T {
        return Value.fromY(parent.get(key))
      },
      observe: Value.watch(type, parent, key)
    }
  }
}
