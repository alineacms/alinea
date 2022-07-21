import {PropsWithChildren} from 'react'
import {Viewport} from './Viewport'

export function UIStory({children}: PropsWithChildren<{}>) {
  return (
    <Viewport attachToBody>
      <div
        style={{
          margin: 'auto'
        }}
      >
        {children}
      </div>
    </Viewport>
  )
}
