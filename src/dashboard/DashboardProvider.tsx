import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import {useAtomValue} from 'jotai'
import type {ComponentType, PropsWithChildren} from 'react'
import {type QueryClient, QueryClientProvider} from 'react-query'
import {
  queryClientAtom,
  useSetDashboardOptions
} from './atoms/DashboardAtoms.js'
import type {WorkerDB} from './boot/WorkerDB.js'
import {ModalPortal} from './view/Modal.js'

export interface DashboardProps {
  db: WorkerDB
  config: Config
  views: Record<string, ComponentType<any>>
  client: LocalConnection
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
