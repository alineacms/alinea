import {useNextPreview} from 'alinea/preview/next'
import {ComponentType, createElement} from 'react'
import {CodeVariantsProvider} from '../view/blocks/CodeVariantsBlock.js'
import {BlogOverview} from './BlogOverview.js'
import {BlogPost} from './BlogPost.js'
import {DocPage} from './DocPage.js'
import {HomePage} from './HomePage.js'
import {Page} from './Page.js'
import {PageViewProps} from './PageView.server'
import {Layout} from './layout/Layout.js'

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
