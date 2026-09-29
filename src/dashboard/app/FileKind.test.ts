import {expect, test} from 'bun:test'
import {
  IcRoundInsertDriveFile,
  IcRoundPictureAsPdf,
  IcRoundTableChart
} from '../icons.js'
import {fileKindVisual} from './FileKind.js'

test('file kinds by extension, with or without a dot and in any case', () => {
  expect(fileKindVisual('.pdf').icon).toBe(IcRoundPictureAsPdf)
  expect(fileKindVisual('PDF').icon).toBe(IcRoundPictureAsPdf)
  expect(fileKindVisual('.XLSX').icon).toBe(IcRoundTableChart)
  expect(fileKindVisual('.otf').icon).toBe(IcRoundInsertDriveFile)
  expect(fileKindVisual(undefined).icon).toBe(IcRoundInsertDriveFile)
})
