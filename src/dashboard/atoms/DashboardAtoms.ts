import type {LocalConnection} from 'alinea/core/Connection'
import type {Session} from 'alinea/core/Session'
import {type User, localUser} from 'alinea/core/User'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import {useEffect} from 'react'
import {QueryClient} from 'react-query'
import type {AppProps} from '../App.js'

export const sessionAtom = atom(undefined! as Session | undefined)

export const dashboardOptionsAtom = atom(undefined! as AppProps)

export function useSetDashboardOptions(options: AppProps) {
  useHydrateAtoms([[dashboardOptionsAtom, options]])

  const {client, config, local} = options
  const isAnonymous = local && !process.env.ALINEA_CLOUD_URL
  if (isAnonymous) {
    const userData =
      typeof process !== 'undefined' &&
      (process.env.ALINEA_USER as string | undefined)
    useHydrateAtoms([
      [
        sessionAtom,
        {
          user: userData ? (JSON.parse(userData) as User) : localUser,
          cnx: client
        }
      ]
    ])
  }

  const setDashboardOptions = useSetAtom(dashboardOptionsAtom)
  useEffect(
    () => setDashboardOptions(options),
    [options.client, options.config]
  )
}

export const queryClientAtom = atom(
  new QueryClient({defaultOptions: {queries: {retry: false}}})
)

export const clientAtom = atom<LocalConnection>(get => {
  return get(dashboardOptionsAtom).client
})

export const configAtom = atom(get => {
  return get(dashboardOptionsAtom).config
})

export const useSession = () => useAtomValue(sessionAtom)

export const useConfig = () => useAtomValue(configAtom)
