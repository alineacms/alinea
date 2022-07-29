import '@alinea/css'
import {PropsWithChildren} from 'react'
import {PreferencesProvider} from './hook/UsePreferences'
import {px} from './util/Units'
import {Viewport} from './Viewport'

export interface UIStoryProps extends PropsWithChildren<{}> {
  fullWidth?: boolean
  fullHeight?: boolean
}

export function UIStory({fullWidth, fullHeight, children}: UIStoryProps) {
  return (
    <PreferencesProvider>
      <Viewport attachToBody>
        <div
          style={{
            marginTop: fullHeight ? px(20) : 'auto',
            marginBottom: fullHeight ? px(20) : 'auto',
            marginLeft: fullWidth ? px(20) : 'auto',
            marginRight: fullWidth ? px(20) : 'auto'
          }}
        >
          {children}
        </div>
      </Viewport>
    </PreferencesProvider>
  )
}
