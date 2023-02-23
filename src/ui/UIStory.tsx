import 'alinea/css'
import {FunctionComponent, PropsWithChildren} from 'react'
import {px} from './util/Units'
import {Viewport} from './Viewport'

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
