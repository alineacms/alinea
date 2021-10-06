import {Dashboard} from '@alinea/dashboard'
import {pagesSchema} from '../schema'

export default function Admin() {
  return (
    process.browser && (
      <Dashboard name="web" schema={pagesSchema} apiUrl="/api/cms" />
    )
  )
}
