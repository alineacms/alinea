import {expect, test} from 'bun:test'
import {atom, useAtomValue} from 'jotai'

const syncAtom = atom(1)
const asyncAtom = atom(async () => 1)
const sometimesAsyncAtom = atom((): number | Promise<number> => 1)

function useReturnAsyncValue(): number {
  // @ts-expect-error Async atom values cannot flow through typed returns.
  return useAtomValue(asyncAtom)
}

function useTypeChecks() {
  useAtomValue(syncAtom).toFixed()

  // @ts-expect-error Async atom values cannot be used directly.
  useAtomValue(asyncAtom).toFixed()
  // @ts-expect-error Maybe-async atom values cannot be used directly.
  useAtomValue(sometimesAsyncAtom).toFixed()

  // @ts-expect-error Async atom values cannot be passed as resolved values.
  const resolvedValue: number = useAtomValue(asyncAtom)

  return resolvedValue
}

test('dashboard async atom reads resolve to a diagnostic type', () => {
  expect(useTypeChecks).toBeDefined()
  expect(useReturnAsyncValue).toBeDefined()
})
