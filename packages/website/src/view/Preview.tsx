import {Page} from '../schema'
import {HomePage} from './HomePage'

type PreviewProps = {
  entry: Page
}

export function Preview({entry}: PreviewProps) {
  switch (entry.$channel) {
    case 'Home':
      return <HomePage {...entry} />
    default:
      return null
  }
}
