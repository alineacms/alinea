import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {
  dashboardEntryDragItem,
  dashboardEntryDragType,
  dashboardEntryDropIds,
  dispense,
  pendingTimerAtom,
  requiredAtom,
  uploadSizeError
} from './utils.js'

test('buffers pending state and keeps it visible for a minimum', async () => {
  const pendingAtom = pendingTimerAtom(40, 400)
  const store = createStore()

  store.set(pendingAtom, true)
  expect(store.get(pendingAtom)).toBe(false)
  await pause(20)
  store.set(pendingAtom, false)
  await pause(40)
  expect(store.get(pendingAtom)).toBe(false)

  store.set(pendingAtom, true)
  await pause(60)
  expect(store.get(pendingAtom)).toBe(true)
  store.set(pendingAtom, false)
  await pause(250)
  expect(store.get(pendingAtom)).toBe(true)
  await pause(200)
  expect(store.get(pendingAtom)).toBe(false)
})

function pause(duration: number) {
  return new Promise<void>(resolve => setTimeout(resolve, duration))
}

test('throws until a required atom is initialized', () => {
  const valueAtom = requiredAtom<string>('test.value')
  const store = createStore()

  expect(() => store.get(valueAtom)).toThrow(
    'Required atom "test.value" was not initialized'
  )

  store.set(valueAtom, 'ready')
  expect(store.get(valueAtom)).toBe('ready')
})

test('dispense caches values by the identity of their keys', () => {
  const cached = dispense((_scope: object, _locale: string | null) => ({}))
  const first = {}
  const second = {}

  expect(cached(first, 'en')).toBe(cached(first, 'en'))
  expect(cached(first, 'en')).not.toBe(cached(first, 'fr'))
  expect(cached(first, 'en')).not.toBe(cached(second, 'en'))
  expect(cached(first, null)).toBe(cached(first, null))
})

test('reads unique entry ids from dropped items', () => {
  expect(
    dashboardEntryDropIds([
      dashboardEntryDragItem('a'),
      {'text/plain': 'b'},
      {[dashboardEntryDragType]: 'c', 'text/plain': 'ignored'},
      {'application/json': '{}'},
      {'text/plain': ''},
      dashboardEntryDragItem('a')
    ])
  ).toEqual(['a', 'b', 'c'])
})

test('reports files that exceed the configured upload limit', () => {
  const file = new File(['oversized'], 'photo.jpg')

  const pdf = new File(['oversized'], 'brochure.pdf')
  expect(uploadSizeError(pdf, {maxUploadSize: pdf.size - 1})).toContain(
    'brochure.pdf'
  )
  expect(
    uploadSizeError(file, {maxUploadSize: file.size - 1, resizeImages: false})
  ).toContain('photo.jpg')
  expect(uploadSizeError(file, {maxUploadSize: file.size})).toBeUndefined()
  expect(uploadSizeError(file, {})).toBeUndefined()
  // Images are checked once they are scaled down
  expect(
    uploadSizeError(file, {
      maxUploadSize: file.size - 1,
      resizeImages: {maxWidth: 100}
    })
  ).toBeUndefined()
  // Pdfs too, once they are compressed
  expect(
    uploadSizeError(pdf, {maxUploadSize: pdf.size - 1}, true)
  ).toBeUndefined()
})
