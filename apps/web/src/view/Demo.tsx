import {Dashboard, Preview} from '@alinea/dashboard'
import {createDemo} from '@alinea/dashboard/demo/DemoData'
import {px, Typo} from '@alinea/ui'
import {useMemo} from 'react'

export type DemoProps = {
  fullPage?: boolean
}

function DemoPreview() {
  return (
    <Preview>
      <div style={{padding: px(20)}}>
        <Typo.H2>Preview</Typo.H2>
        <Typo.P>
          This pane will show a live preview of the current page. It will be
          enabled as soon as we have some suitable demo content ready.
        </Typo.P>
      </div>
    </Preview>
  )
}

export default function Demo({fullPage}: DemoProps) {
  const {client, config} = useMemo(createDemo, [])
  config.options.workspaces.demo.options.preview = DemoPreview
  return <Dashboard fullPage={fullPage} config={config} client={client} />
}
