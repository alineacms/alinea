import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'

const server = setupServer(
  http.get('https://www.alinea.cloud/api/v1/tree', () => {
    return HttpResponse.json({
      id: '15d42a4d-1948-4de4-ba78-b8a893feaf45',
      firstName: 'John'
    })
  })
)

// Start the interception.
server.listen()

await import('next/dist/bin/next')
