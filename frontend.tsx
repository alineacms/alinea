import {views} from '#/field/views.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {App} from './src/dashboard/App.js'
import {cms, db} from './src/dashboard/fixture/cms.ts?alinea'

const elem = document.getElementById('root')!
const fixtureConnection = createTestConnection(db)

const sourceMutate = db.mutate.bind(db)

db.mutate = async (...args: Parameters<typeof sourceMutate>) => {
  console.log('Mutate called with', args)
  return sourceMutate(...args)
}

const app = (
  <StrictMode>
    <App
      graph={db}
      events={db.index}
      config={cms.config}
      client={fixtureConnection}
      views={views}
      alineaDev
    />
  </StrictMode>
)

createRoot(elem).render(app)
