import {useAtomValue} from 'jotai'
import {policyAtom} from '../atoms/PolicyAtom.js'

export function usePolicy() {
  return useAtomValue(policyAtom)
}
