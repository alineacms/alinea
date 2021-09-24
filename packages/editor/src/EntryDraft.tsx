import {Entry, InputPath} from '@alinea/core'
import * as Y from 'yjs'

const ROOT_KEY = 'root'

function toYValue(value: any) {
  if (Array.isArray(value)) {
    const array = new Y.Array()
    value.forEach(item => {
      array.push(toYValue(item))
    })
    return array
  }
  if (value && typeof value === 'object') {
    const map = new Y.Map()
    Object.keys(value).forEach(key => {
      map.set(key, value[key])
    })
    return map
  }
  return value
}

// Todo: use the schema to fill the doc
function docFromEntry(entry: Entry) {
  const doc = new Y.Doc()
  const root = doc.getMap(ROOT_KEY)
  const data: {[key: string]: any} = entry
  for (const key of Object.keys(data)) {
    root.set(key, toYValue(data[key]))
  }
  return doc
}

export class EntryDraft implements Entry {
  public doc: Y.Doc

  constructor(public entry: Entry) {
    this.doc = docFromEntry(entry)
  }

  private get root() {
    return this.doc.getMap(ROOT_KEY)
  }

  get path() {
    return this.root.get('path')
  }

  get title() {
    return this.root.get('title')
  }

  get channel() {
    return this.root.get('channel')
  }

  get<T>(target: Y.AbstractType<any>, path: Array<string | number>): T {
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
    if (path.length === 1) return this.root
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
