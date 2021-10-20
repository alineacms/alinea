import {Page} from '../schema'
import {DocsPage} from './DocsPage'
import {HomePage} from './HomePage'

type PreviewProps = {
  entry: Page
}

export function PageView({entry}: PreviewProps) {
  switch (entry.$channel) {
    case 'Home':
      return <HomePage {...entry} />
    case 'Docs':
      return <DocsPage {...entry} />
    default:
      return <div>404</div>
  }
}
