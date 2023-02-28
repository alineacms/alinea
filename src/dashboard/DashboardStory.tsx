import {ErrorBoundary, px} from 'alinea/ui'
import {UIStory, UIStoryProps} from 'alinea/ui/UIStory'
import {FunctionComponent, useMemo} from 'react'
import {QueryClient, QueryClientProvider} from 'react-query'
import {createDemo} from './demo/DemoData.js'
import {DashboardProvider} from './hook/UseDashboard.js'
import {EntrySummaryProvider} from './hook/UseEntrySummary.js'
import {SessionProvider} from './hook/UseSession.js'
import {Toolbar} from './view/Toolbar.js'

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export function DashboardStory({children, ...props}: UIStoryProps) {
  const {client, config, session} = useMemo(createDemo, [])
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DashboardProvider value={{client, config}}>
          <SessionProvider value={session}>
            <UIStory {...props}>
              <Toolbar.Provider>
                <div
                  style={{
                    position: 'absolute',
                    top: px(-20),
                    background: `var(--alinea-lift)`,
                    zIndex: 5,
                    padding: `0 ${px(20)}`
                  }}
                >
                  <Toolbar.Portal />
                </div>
                <EntrySummaryProvider>{children}</EntrySummaryProvider>
              </Toolbar.Provider>
            </UIStory>
          </SessionProvider>
        </DashboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export function dashboardDecorator(props: UIStoryProps = {}) {
  return [
    (Story: FunctionComponent) => (
      <>
        <DashboardStory {...props}>
          <Story />
        </DashboardStory>
      </>
    )
  ]
}
