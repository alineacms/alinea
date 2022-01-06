import {PageProps} from '../pages'
import {DocPage} from './DocPage'
import {DocsPage} from './DocsPage'
import {HomePage} from './HomePage'
import {Layout} from './layout/Layout'

function EntryView(props: PageProps) {
  switch (props?.type) {
    case 'Home':
      return <HomePage {...props} />
    case 'Docs':
      return <DocsPage {...props} />
    case 'Doc':
      return <DocPage {...props} />
    default:
      return <div style={{textAlign: 'center'}}>404</div>
  }
}

export function PageView(props: PageProps) {
  return (
    <Layout>
      <EntryView {...props} />
    </Layout>
  )
}
