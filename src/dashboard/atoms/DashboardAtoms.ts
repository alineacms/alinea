import {Connection, Session} from 'alinea/core'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import {useEffect} from 'react'
import {QueryClient} from 'react-query'
import {AppProps} from '../App.js'

export const sessionAtom = atom(undefined! as Session | undefined)

export const dashboardOptionsAtom = atom(undefined! as AppProps)

export function useSetDashboardOptions(options: AppProps) {
  useHydrateAtoms([[dashboardOptionsAtom, options]])

  const {client, config, dev} = options
  const auth = config.dashboard?.auth
  if (dev || !auth)
    useHydrateAtoms([
      [
        sessionAtom,
        {
          user: {sub: 'anonymous'},
          cnx: client,
          end: async () => {}
        }
      ]
    ])

  const setDashboardOptions = useSetAtom(dashboardOptionsAtom)
  useEffect(() => setDashboardOptions(options), [options])
}

export const queryClientAtom = atom(
  new QueryClient({defaultOptions: {queries: {retry: false}}})
)

export const clientAtom = atom<Connection>(get => {
  return get(dashboardOptionsAtom).client
})

export const configAtom = atom(get => {
  return get(dashboardOptionsAtom).config
})

export const useSession = () => useAtomValue(sessionAtom)

export const useConfig = () => useAtomValue(configAtom)
