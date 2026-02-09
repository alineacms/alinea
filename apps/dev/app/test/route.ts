import {cms} from '@/cms'
import {Page} from '../../src/schema/Page'

export async function GET() {
  const rootPage = await cms.get({
    type: Page,
    locale: 'en',
    path: 'root-page',
    syncInterval: 0
  })
  return Response.json({page: rootPage})
}
