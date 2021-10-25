import {Page} from '../schema'
import {DocPage} from './DocPage'
import {DocsPage} from './DocsPage'
import {HomePage} from './HomePage'
import {Layout} from './layout/Layout'

export type PageViewProps = {
  entry: Page
}

function EntryView({entry}: PageViewProps) {
  switch (entry?.$channel) {
    case 'Home':
      return <HomePage {...entry} />
    case 'Docs':
      return <DocsPage {...entry} />
    case 'Doc':
      return <DocPage {...entry} />
    default:
      return <div style={{textAlign: 'center'}}>404</div>
  }
}

export function PageView({entry}: PageViewProps) {
  return (
    <Layout>
      <EntryView entry={entry} />
    </Layout>
  )
}
