import {DashboardProvider, SessionProvider, Toolbar} from '@alinea/dashboard'
import {createDemo} from '@alinea/dashboard/demo/DemoData'
import {QueryClient, QueryClientProvider} from '@alinea/shared/react-query'
import {fromModule, Viewport} from '@alinea/ui'
import {PropsWithChildren, useMemo} from 'react'
import css from './CodeSample.module.scss'

const styles = fromModule(css)

export type CodeSampleProps = PropsWithChildren<{}>

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export function CodeSample({children}: CodeSampleProps) {
  const {client, config, session} = useMemo(createDemo, [])
  return (
    <Viewport color="#5661E5" contain className={styles.root()}>
      <DashboardProvider value={{client, config}}>
        <SessionProvider value={session}>
          <QueryClientProvider client={queryClient}>
            <Toolbar.Provider>{children}</Toolbar.Provider>
          </QueryClientProvider>
        </SessionProvider>
      </DashboardProvider>
    </Viewport>
  )
}
