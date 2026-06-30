import {createId} from '#/core/Id.js'
import {Reference} from '#/core/Reference.js'
import {EntryReference} from '#/picker/entry/EntryReference.js'
import {UrlReference} from '#/picker/url.js'
import type {HTMLProps} from 'react'

interface Anchor extends HTMLProps<HTMLAnchorElement> {
  'data-id'?: string
  'data-entry'?: string
  'data-link'?: 'entry' | 'file' | 'url'
  'data-suffix'?: string
}

export function referenceToAttributes(reference: Reference): Anchor {
  // Todo: don't stringly type here
  switch (reference[Reference.type]) {
    case 'url': {
      const ref = reference as UrlReference
      return {
        'data-id': ref[Reference.id],
        'data-entry': undefined,
        'data-link': 'url',
        href: ref._url,
        target: ref._target
      }
    }
    case 'entry': {
      const ref = reference as EntryReference
      return {
        'data-id': ref[Reference.id],
        'data-entry': ref[EntryReference.entry],
        'data-link': 'entry',
        'data-suffix': ref._suffix,
        href: undefined,
        target: undefined
      }
    }
    case 'file': {
      const ref = reference as EntryReference
      return {
        'data-id': ref[Reference.id],
        'data-entry': ref[EntryReference.entry],
        'data-link': 'file',
        'data-suffix': undefined,
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
  if (attributes['data-entry']) {
    const type = attributes['data-link'] === 'file' ? 'file' : 'entry'
    return {
      [Reference.id]: id,
      [Reference.type]: type,
      [EntryReference.entry]: attributes['data-entry'],
      [EntryReference.suffix]:
        type === 'entry' ? attributes['data-suffix'] : undefined
    } as EntryReference
  }
  return {
    [Reference.id]: id,
    [Reference.type]: 'url',
    [UrlReference.url]: attributes.href,
    [UrlReference.target]: attributes.target
  } as UrlReference
}
