import {Reference} from 'alinea/core/Reference'
import {EntryReference} from 'alinea/picker/entry'
import {UrlReference} from 'alinea/picker/url'
import type {HTMLProps} from 'react'

interface Anchor extends HTMLProps<HTMLAnchorElement> {
  'data-id'?: string
  'data-entry'?: string
}

export function referenceToAttributes(reference: Reference): Anchor {
  // Todo: don't stringly type here
  if (reference.type === 'url') {
    const ref = reference as UrlReference
    return {
      'data-id': ref.id,
      href: ref.url,
      target: ref.target
    }
  } else if (reference.type === 'entry') {
    const ref = reference as EntryReference
    return {
      'data-id': ref.id,
      'data-entry': ref.entry
    }
  }
  throw new Error(`Unexpected reference type: ${reference.type}`)
}

export function attributesToReference(
  attributes: Anchor
): Reference | undefined {
  const id = attributes['data-id']
  if (!id) return
  if (attributes['data-entry'])
    return {
      id,
      type: 'entry',
      entry: attributes['data-entry']
    } as EntryReference
  return {
    id,
    type: 'url',
    url: attributes.href,
    target: attributes.target
  } as UrlReference
}
