import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {useAtomValue} from 'jotai'
import {PropsWithChildren} from 'react'
import {QueryClient, QueryClientProvider} from 'react-query'
import {
  queryClientAtom,
  useSetDashboardOptions
} from './atoms/DashboardAtoms.js'
import {ModalPortal} from './view/Modal.js'

export interface DashboardProps {
  config: Config
  client: Connection
  queryClient?: QueryClient
  fullPage?: boolean
  dev?: boolean
  alineaDev?: boolean
}

export function DashboardProvider(props: PropsWithChildren<DashboardProps>) {
  const fullPage = props.fullPage !== false
  useSetDashboardOptions({fullPage, ...props})
  const queryClient = useAtomValue(queryClientAtom)
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
      <ModalPortal />
    </QueryClientProvider>
  )
}
