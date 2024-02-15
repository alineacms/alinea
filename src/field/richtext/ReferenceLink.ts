import {createId} from 'alinea/core/Id'
import {Reference} from 'alinea/core/Reference'
import {EntryReference, FileReference} from 'alinea/picker/entry/EntryReference'
import {UrlReference} from 'alinea/picker/url'
import type {HTMLProps} from 'react'

interface Anchor extends HTMLProps<HTMLAnchorElement> {
  'data-id'?: string
  'data-entry'?: string
  'data-type'?: 'entry' | 'file' | 'url'
}

export function referenceToAttributes(reference: Reference): Anchor {
  // Todo: don't stringly type here
  switch (reference[Reference.type]) {
    case 'url': {
      const ref = reference as UrlReference
      return {
        'data-id': ref[Reference.id],
        'data-entry': undefined,
        'data-type': 'url',
        href: ref._url,
        target: ref._target
      }
    }
    case 'entry': {
      const ref = reference as EntryReference
      return {
        'data-id': ref[Reference.id],
        'data-entry': ref[EntryReference.entry],
        'data-type': 'entry',
        href: undefined,
        target: undefined
      }
    }
    case 'file': {
      const ref = reference as FileReference
      return {
        'data-id': ref[Reference.id],
        'data-entry': ref[EntryReference.entry],
        'data-type': 'file',
        href: undefined,
        target: undefined
      }
    }
    default:
      throw new Error(`Unexpected reference type: ${reference[Reference.type]}`)
  }
}

export function attributesToReference(
  attributes: Anchor
): Reference | undefined {
  const id = attributes['data-id']
  if (!id) {
    if (attributes.href)
      return {
        [Reference.id]: createId(),
        [Reference.type]: 'url',
        [UrlReference.url]: attributes.href,
        [UrlReference.target]: attributes.target
      } as UrlReference
    return
  }
  if (attributes['data-entry'])
    return {
      [Reference.id]: id,
      [Reference.type]: attributes['data-type'] === 'file' ? 'file' : 'entry',
      [EntryReference.entry]: attributes['data-entry']
    } as EntryReference
  return {
    [Reference.id]: id,
    [Reference.type]: 'url',
    [UrlReference.url]: attributes.href,
    [UrlReference.target]: attributes.target
  } as UrlReference
}
