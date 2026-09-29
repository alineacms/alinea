import {expect, test} from 'bun:test'
import {fileKind} from './FileKind.js'

test('file kinds by extension, with or without a dot and in any case', () => {
  expect(fileKind('.pdf')).toBe('pdf')
  expect(fileKind('PDF')).toBe('pdf')
  expect(fileKind('.XLSX')).toBe('spreadsheet')
  expect(fileKind('.otf')).toBe('other')
  expect(fileKind(undefined)).toBe('other')
})
