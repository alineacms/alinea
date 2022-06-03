import {ComponentType, createElement} from 'react'
import {CodeVariantsProvider} from '../view/blocks/CodeVariantsBlock'
import {DocPage} from './DocPage'
import {DocsPage} from './DocsPage'
import {HomePage} from './HomePage'
import {Layout} from './layout/Layout'
import {PageViewProps} from './PageView.server'

const views: {[key: string]: ComponentType<any>} = {
  Home: HomePage,
  Docs: DocsPage,
  Doc: DocPage
}

function EntryView({entry}: PageViewProps) {
  const {type} = entry
  if (type in views) return createElement(views[type], entry)
  return <div style={{textAlign: 'center'}}>404</div>
}

export function PageView(props: PageViewProps) {
  return (
    <Layout {...props.layout}>
      <CodeVariantsProvider>
        <EntryView {...props} />
      </CodeVariantsProvider>
    </Layout>
  )
}
