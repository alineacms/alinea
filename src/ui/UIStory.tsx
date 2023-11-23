import {Viewport} from 'alinea/dashboard/view/Viewport'
import {FunctionComponent, PropsWithChildren} from 'react'
import '../global.css'
import {px} from './util/Units.js'

export interface UIStoryProps extends PropsWithChildren<{}> {
  fullWidth?: boolean
  fullHeight?: boolean
}

export function UIStory({fullWidth, fullHeight, children}: UIStoryProps) {
  return (
    <Viewport attachToBody>
      <div
        style={{
          zIndex: 0,
          marginTop: fullHeight ? px(30) : 'auto',
          marginBottom: fullHeight ? px(30) : 'auto',
          marginLeft: fullWidth ? px(30) : 'auto',
          marginRight: fullWidth ? px(30) : 'auto'
        }}
      >
        {children}
      </div>
    </Viewport>
  )
}

export function uiDecorator(props: UIStoryProps = {}) {
  return [
    (Story: FunctionComponent) => (
      <UIStory {...props}>
        <Story />
      </UIStory>
    )
  ]
}
