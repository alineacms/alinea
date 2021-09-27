import {Entry, InputPath} from '@alinea/core'
import {WebsocketProvider} from 'y-websocket'
import * as Y from 'yjs'

const ROOT_KEY = 'root'

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

  get title() {
    return this.root.get('title')
  }

  get channel() {
    return this.root.get('channel')
  }

  get(target: Y.AbstractType<any>, path: Array<string | number>): any {
    if (path.length === 0) return target
    const current = path[0]
    switch (typeof current) {
      case 'string':
        if (!(target instanceof Y.Map))
          throw `Could not get property ${current}`
        return this.get(target.get(current), path.slice(1))
      case 'number':
        if (!(target instanceof Y.Array))
          throw `Could not get property ${current}`
        return this.get(target.get(current), path.slice(1))
    }
    throw `Could not get property ${current}`
  }

  getParent<T>(path: InputPath<T>): any {
    return this.get(this.root, path.slice(0, -1))
  }

  getInput<T>(path: InputPath<T>) {
    const key = path[path.length - 1]
    const parent = this.getParent(path)
    return {
      get value(): T {
        return parent.get(key)
      },
      setValue(value: T) {
        return parent.set(key, value)
      },
      observe(fun: () => void) {
        function watch(event: Y.YMapEvent<any> | Y.YArrayEvent<any>) {
          if (event instanceof Y.YMapEvent) {
            if (event.keysChanged.has(key)) fun()
          } else {
            throw 'Not implemented'
          }
        }
        parent.observe(watch)
        return () => parent.unobserve(watch)
      }
    }
  }
}
