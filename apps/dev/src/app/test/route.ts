import {cms} from '@/cms'
import {Page} from '../../schema/Page'

export async function GET(request: Request) {
  const rootPage = await cms.get({type: Page, locale: 'en', path: 'root-page'})
  return Response.json({page: rootPage})
}
