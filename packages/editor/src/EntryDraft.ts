import {Entry, InputPath, toYValue} from '@alinea/core'
import {WebsocketProvider} from 'y-websocket'
import * as Y from 'yjs'

const ROOT_KEY = 'root'

export type ArrayMutator<T> = {
  delete: (key: number) => void
  push: (item: T) => void
}

export type FieldMutator<T> = T extends Array<infer K>
  ? ArrayMutator<K>
  : T extends {[key: string]: any}
  ? {set<K extends keyof T>(key: K, value: T[K]): void}
  : (item: T) => void

type Parent = (Y.Array<any> | Y.Map<any>) & {get(key: string | number): any}

function inputMutator<T>(
  parent: Parent,
  key: string | number
): FieldMutator<T> {
  const item = parent.get(key)
  if (item instanceof Y.Array) {
    return {
      push: (row: T) => {
        console.log(row)
        item.push([toYValue(row)])
      },
      delete: item.delete.bind(item)
    } as FieldMutator<T>
  }
  if (item instanceof Y.Map) {
    return {
      set: (key: string, value) => item.set(key, toYValue(value))
    } as FieldMutator<T>
  }
  if (parent instanceof Y.Array) {
    throw `Cannot mutate array fields`
  }
  return ((value: T) => parent.set(key as string, value)) as FieldMutator<T>
}

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

  get $channel() {
    return this.root.get('$channel')
  }

  get(target: Y.AbstractType<any>, path: Array<string | number>): Parent {
    if (path.length === 0) return target as Parent
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

  getParent<T>(path: InputPath<T>): Parent {
    return this.get(this.root, path.slice(0, -1))
  }

  getInput<T>(path: InputPath<T>) {
    const key = path[path.length - 1]
    const parent = this.getParent(path)
    const input = parent.get(key)
    const mutator: FieldMutator<T> = inputMutator<T>(parent, key)
    const target =
      input instanceof Y.Map || input instanceof Y.Array ? input : parent
    return {
      mutator,
      get value(): T {
        const value = parent.get(key)
        if (value && typeof value === 'object' && 'toJSON' in value)
          return value.toJSON()
        return value
      },
      observe(fun: () => void) {
        function watch(event: Y.YMapEvent<any> | Y.YArrayEvent<any>) {
          if (event instanceof Y.YMapEvent) {
            if (event.keysChanged.has(key)) fun()
          } else {
            fun()
          }
        }
        target.observe(watch)
        return () => target.unobserve(watch)
      }
    }
  }
}
