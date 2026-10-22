import {suite} from '@alinea/suite'
import {fileAccepts} from './FileAccept.js'

const test = suite(import.meta)

test('every file matches without an accept list', () => {
  test.ok(fileAccepts(undefined, 'notes.txt'))
  test.ok(fileAccepts(' ', 'notes.txt'))
})

test('extensions match case insensitively', () => {
  test.ok(fileAccepts('.pdf, .DOCX', 'Report.PDF'))
  test.ok(fileAccepts('.pdf,.docx', 'letter.docx'))
  test.not.ok(fileAccepts('.pdf', 'image.png'))
  test.not.ok(fileAccepts('.pdf', 'pdf'))
})

test('media type groups match the media type, or else the extension', () => {
  test.ok(fileAccepts('image/*', 'photo.jpg'))
  test.ok(fileAccepts('image/*', 'photo', 'image/png'))
  test.not.ok(fileAccepts('image/*', 'clip.mp4'))
  test.ok(fileAccepts('video/*', 'clip.mp4'))
  test.ok(fileAccepts('*/*', 'anything.bin'))
})

test('media types match the media type of the file', () => {
  test.ok(fileAccepts('application/pdf', 'report.pdf', 'application/pdf'))
  test.not.ok(fileAccepts('application/pdf', 'report.pdf'))
})
