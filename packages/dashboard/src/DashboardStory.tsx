import {Viewport} from '@alinea/ui'
import {createDemo} from '@alinea/web/view/Demo'
import {PropsWithChildren, useMemo} from 'react'
import {DashboardProvider} from './hook/DashboardProvider'

export function DashboardStory({children}: PropsWithChildren<{}>) {
  const {client, config, session} = useMemo(createDemo, [])
  return (
    <Viewport attachToBody>
      <DashboardProvider value={{client, config}}>
        <SessionProvider value={session}>
          <div
            style={{
              margin: 'auto'
            }}
          >
            {children}
          </div>
        </SessionProvider>
      </DashboardProvider>
    </Viewport>
  )
}
