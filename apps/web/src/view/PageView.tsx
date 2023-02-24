import {useNextPreview} from 'alinea/preview/next'
import {ComponentType, createElement} from 'react'
import {CodeVariantsProvider} from '../view/blocks/CodeVariantsBlock'
import {BlogOverview} from './BlogOverview'
import {BlogPost} from './BlogPost'
import {DocPage} from './DocPage'
import {HomePage} from './HomePage'
import {Layout} from './layout/Layout'
import {Page} from './Page'
import {PageViewProps} from './PageView.server'

const views: {[key: string]: ComponentType<any>} = {
  Home: HomePage,
  Doc: DocPage,
  Page: Page,
  BlogPost: BlogPost,
  BlogOverview: BlogOverview
}

function EntryView({entry}: PageViewProps) {
  const {type} = entry
  if (type in views) return createElement(views[type], entry)
  return <div style={{textAlign: 'center'}}>404</div>
}

export function PageView(props: PageViewProps) {
  useNextPreview()
  return (
    <Layout {...props.layout}>
      <CodeVariantsProvider>
        <EntryView {...props} />
      </CodeVariantsProvider>
    </Layout>
  )
}
