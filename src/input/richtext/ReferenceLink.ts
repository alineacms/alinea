import {createError} from 'alinea/core/ErrorWithCode'
import {Reference} from 'alinea/core/Reference'
import {EntryReference} from 'alinea/picker/entry'
import {UrlReference} from 'alinea/picker/url'
import type {HTMLProps} from 'react'

interface Anchor extends HTMLProps<HTMLAnchorElement> {
  'data-id'?: string
  'data-entry'?: string
}

export function referenceToAttributes(reference: Reference): Anchor {
  if (UrlReference.isUrl(reference)) {
    return {
      'data-id': reference.id,
      href: reference.url,
      target: reference.target
    }
  } else if (EntryReference.isEntry(reference)) {
    return {
      'data-id': reference.id,
      'data-entry': reference.entry
    }
  }
  throw createError(`Unexpected reference type: ${reference.type}`)
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
