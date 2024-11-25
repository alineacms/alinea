import {createExample} from 'alinea/backend/test/Example'
import {DashboardProvider} from 'alinea/dashboard/DashboardProvider'
import {defaultViews} from 'alinea/dashboard/editor/DefaultViews'
import {Viewport} from 'alinea/dashboard/view/Viewport'
import {FieldToolbar} from 'alinea/dashboard/view/entry/FieldToolbar'
import {FunctionComponent, PropsWithChildren} from 'react'
import '../global.css'
import {px} from './util/Units.js'

const example = createExample()
const client = undefined! // await example.connection()

export interface UIStoryProps extends PropsWithChildren<{}> {
  fullWidth?: boolean
  fullHeight?: boolean
}

export function UIStory({fullWidth, fullHeight, children}: UIStoryProps) {
  return (
    <DashboardProvider
      dev
      config={example.config}
      client={client}
      views={defaultViews}
    >
      <Viewport attachToBody>
        <FieldToolbar.Provider>
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
          <FieldToolbar.Root />
        </FieldToolbar.Provider>
      </Viewport>
    </DashboardProvider>
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
