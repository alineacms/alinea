import {expect, test} from 'bun:test'
import {contentProblem, isAccepted, sniffType} from './FormFileTypes.js'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])
const pdf = new TextEncoder().encode('%PDF-1.7 ...')
const script = new TextEncoder().encode('#!/bin/sh\nrm -rf /\n')

test('files are told apart by their first bytes', () => {
  expect(sniffType(png)).toBe('image/png')
  expect(sniffType(pdf)).toBe('application/pdf')
  expect(sniffType(script)).toBe('text/plain')
  expect(sniffType(new Uint8Array([0, 1, 2]))).toBeUndefined()
})

test('the accept list matches extensions and types', () => {
  const file = {name: 'Error.PNG', size: 9, type: 'image/png'}
  expect(isAccepted('.png, .jpg', file)).toBe(true)
  expect(isAccepted('image/*', file)).toBe(true)
  expect(isAccepted('.pdf', file)).toBe(false)
  expect(isAccepted('', file)).toBe(true)
})

test('a file must be what its name says', () => {
  const info = (name: string) => ({name, size: 0, type: ''})
  expect(contentProblem(info('error.png'), png)).toBeUndefined()
  expect(contentProblem(info('invoice.pdf'), script)).toBe(
    'invoice.pdf is not the kind of file its name says'
  )
  expect(contentProblem(info('notes.txt'), png)).toBe(
    'notes.txt is not the kind of file its name says'
  )
  expect(contentProblem(info('photo.heic'), png)).toBeUndefined()
})
