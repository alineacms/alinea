import {expect, test} from 'bun:test'
import {atom} from 'jotai'
import {
  useAsyncAtom,
  useAsyncAtomValue,
  useAtom,
  useAtomValue
} from './AtomHooks.js'

const syncAtom = atom(1)
const asyncAtom = atom(async () => 1)
const asyncWritableAtom = atom(
  async () => 1,
  () => {}
)

function useTypeChecks() {
  useAtomValue(syncAtom)
  useAtom(syncAtom)
  useAsyncAtomValue(asyncAtom)
  useAsyncAtom(asyncWritableAtom)

  // @ts-expect-error Async atoms require the explicit async hook.
  useAtomValue(asyncAtom)
  // @ts-expect-error Async writable atoms require the explicit async hook.
  useAtom(asyncWritableAtom)
}

test('dashboard atom hooks expose explicit async variants', () => {
  expect(useTypeChecks).toBeDefined()
  expect(syncAtom).toBeDefined()
  expect(asyncAtom).toBeDefined()
})
