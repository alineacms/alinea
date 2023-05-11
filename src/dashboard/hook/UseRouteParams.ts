import {useAtomValue} from 'jotai'
import {matchingRouteAtom} from '../util/HashRouter.js'

export const useRouteParams = (): Record<string, string> =>
  useAtomValue(matchingRouteAtom).params
