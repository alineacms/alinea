import {Session} from 'alinea/core'
import {Client} from 'alinea/core/Client'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import {useEffect} from 'react'
import {QueryClient} from 'react-query'
import {AppProps} from '../App.js'

export const dashboardOptionsAtom = atom(undefined! as AppProps)

export function useSetDashboardOptions(options: AppProps) {
  useHydrateAtoms([[dashboardOptionsAtom, options]])
  const setDashboardOptions = useSetAtom(dashboardOptionsAtom)
  useEffect(() => setDashboardOptions(options), [options])
}

export const queryClientAtom = atom(
  new QueryClient({defaultOptions: {queries: {retry: false}}})
)

export const clientAtom = atom<Client>(get => {
  return get(dashboardOptionsAtom).client
})

export const configAtom = atom(get => {
  return get(dashboardOptionsAtom).config
})

export const sessionAtom = atom<Session>(get => {
  const {client, config} = get(dashboardOptionsAtom)
  const auth = config.backend?.auth
  if (!auth)
    return {
      user: {sub: 'anonymous'},
      cnx: client,
      end: async () => {}
    }
  return undefined!
})

export const useSession = () => useAtomValue(sessionAtom)
