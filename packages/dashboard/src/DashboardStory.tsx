import {ErrorBoundary} from '@alinea/ui'
import {UIStory, UIStoryProps} from '@alinea/ui/UIStory'
import {useMemo} from 'react'
import {QueryClient, QueryClientProvider} from 'react-query'
import {createDemo} from '../../../apps/web/src/view/Demo'
import {DashboardProvider} from './hook/UseDashboard'
import {SessionProvider} from './hook/UseSession'

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export function DashboardStory({children, ...props}: UIStoryProps) {
  const {client, config, session} = useMemo(createDemo, [])
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DashboardProvider value={{client, config}}>
          <SessionProvider value={session}>
            <UIStory {...props}>{children}</UIStory>
          </SessionProvider>
        </DashboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
