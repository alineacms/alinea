import {Connection, Session, User, localUser} from 'alinea/core'
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
  if (dev || !auth) {
    const userData = process.env.ALINEA_USER as string | undefined
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

export const clientAtom = atom<Connection>(get => {
  return get(dashboardOptionsAtom).client
})

export const configAtom = atom(get => {
  return get(dashboardOptionsAtom).config
})

export const useSession = () => useAtomValue(sessionAtom)

export const useConfig = () => useAtomValue(configAtom)
