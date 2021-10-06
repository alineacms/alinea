import {Dashboard} from '@alinea/dashboard/index.js'
import {pagesSchema} from '../schema'

export default function Admin() {
  return (
    process.browser && (
      <Dashboard
        name="web"
        schema={pagesSchema}
        apiUrl={'http://localhost:3000/api/cms'}
      />
    )
  )
}
