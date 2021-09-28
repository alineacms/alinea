import * as Y from 'yjs'
import {Entry} from '.'

const ROOT_KEY = 'root'

export function toYValue(value: any) {
  if (Array.isArray(value)) {
    const array = new Y.Array()
    value.forEach(item => {
      array.push([toYValue(item)])
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
export function docFromEntry(doc: Y.Doc, entry: Entry) {
  const root = doc.getMap(ROOT_KEY)
  const data: {[key: string]: any} = entry
  for (const key of Object.keys(data)) {
    root.set(key, toYValue(data[key]))
  }
  return doc
}
