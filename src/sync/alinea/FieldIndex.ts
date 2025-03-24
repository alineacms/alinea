import type {Entry} from 'alinea/core'
import {ArrayTree} from 'tiny-tree'
import {compareStrings} from '../Utils.ts'

interface Range<T> {
  gt?: T
  gte?: T
  lte?: T
  lt?: T
}

export class FieldIndex {
  #tree = new ArrayTree<string, Array<Entry>>()

  constructor(entries: Array<Entry>, key: keyof Entry) {
    const values = new Map<string, Array<Entry>>()
    for (const entry of entries) {
      const value = entry[key]
      if (typeof value !== 'string') throw new Error('Field must be a string')
      if (!values.has(value)) values.set(value, [])
      const list = values.get(value)!
      list.push(entry)
    }
    const sorted = Array.from(values).sort(([a], [b]) => {
      return compareStrings(a, b)
    })
    this.#tree.bulkLoad(sorted)
  }

  get(value: string): Array<Entry> {
    return this.#tree.get(value) ?? []
  }

  within(range: Range<string>): Array<Entry> {
    return this.#tree
      .toArray(
        {
          minInclusive: range.gte,
          maxInclusive: range.lte,
          minExclusive: range.gt,
          maxExclusive: range.lt
        },
        true
      )
      .flat()
  }
}
