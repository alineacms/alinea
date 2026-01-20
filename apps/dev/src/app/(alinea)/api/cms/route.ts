import {createHandler} from 'alinea/next'
import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {cms} from '@/cms'

const server = setupServer(
  http.all('https://www.alinea.cloud/api/v1/tree', () => {
    console.log('Mocked CMS request')
    return HttpResponse.json({success: true, data: null})
  })
)
server.listen()

const handler = createHandler({cms})
export const GET = handler
export const POST = handler
