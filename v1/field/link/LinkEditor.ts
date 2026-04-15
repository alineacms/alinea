import {createId} from '#/core/Id.js'
import {Reference} from '#/core/Reference.js'
import {ListEditor} from '#/core/field/ListField.js'
import type {ListRow} from '#/core/shape/ListShape.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import {UrlReference} from '#/picker/url/UrlPicker.js'

export class LinkEditor<StoredValue extends Reference> {
  row?: StoredValue

  add(type: StoredValue['_type'], value: Omit<StoredValue, '_type' | '_id'>) {
    this.row = {
      [Reference.id]: createId(),
      [Reference.type]: type,
      ...value
    } as StoredValue
    return this
  }

  addUrl(
    data: {url: string; title: string; target?: string},
    fields?: Record<string, unknown>
  ) {
    return this.add('url', {
      [UrlReference.url]: data.url,
      [UrlReference.title]: data.title,
      [UrlReference.target]: data.target ?? '_blank',
      ...fields
    } as any)
  }

  addEntry(entryId: string, fields?: Record<string, unknown>) {
    return this.add('entry', {
      [EntryReference.entry]: entryId,
      ...fields
    } as any)
  }

  addImage(entryId: string, fields?: Record<string, unknown>) {
    return this.add('image', {
      [EntryReference.entry]: entryId,
      ...fields
    } as any)
  }

  addFile(entryId: string, fields?: Record<string, unknown>) {
    return this.add('file', {[EntryReference.entry]: entryId, ...fields} as any)
  }

  value() {
    if (!this.row) throw new Error('LinkEditor row not created')
    return this.row
  }
}

export class LinksEditor<
  StoredValue extends ListRow
> extends ListEditor<StoredValue> {
  addUrl(
    data: {url: string; title: string; target?: string},
    fields?: Record<string, unknown>
  ) {
    return this.add('url', {
      [UrlReference.url]: data.url,
      [UrlReference.title]: data.title,
      [UrlReference.target]: data.target ?? '_blank',
      ...fields
    } as any)
  }

  addEntry(entryId: string, fields?: Record<string, unknown>) {
    return this.add('entry', {
      [EntryReference.entry]: entryId,
      ...fields
    } as any)
  }

  addImage(entryId: string, fields?: Record<string, unknown>) {
    return this.add('image', {
      [EntryReference.entry]: entryId,
      ...fields
    } as any)
  }

  addFile(entryId: string, fields?: Record<string, unknown>) {
    return this.add('file', {[EntryReference.entry]: entryId, ...fields} as any)
  }
}
