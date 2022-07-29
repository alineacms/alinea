import {PropsWithChildren} from 'react'
import {PreferencesProvider} from './hook/UsePreferences'
import {Viewport} from './Viewport'

export function UIStory({children}: PropsWithChildren<{}>) {
  return (
    <PreferencesProvider>
      <Viewport attachToBody>
        <div
          style={{
            margin: 'auto'
          }}
        >
          {children}
        </div>
      </Viewport>
    </PreferencesProvider>
  )
}
