import {cms} from '../cms'
import {Page} from '../schema/Page'

export default async function Landing() {
  const rootPage = await cms.get({type: Page, locale: 'en', path: 'root-page'})
  console.log(rootPage)
  return <div>Hello world</div>
}
