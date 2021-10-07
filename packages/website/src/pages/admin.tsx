import {Dashboard} from '@alinea/dashboard'
import {schema} from '../schema'

export default function Admin() {
  return (
    process.browser && (
      <Dashboard name="web" schema={schema} apiUrl="/api/cms" />
    )
  )
}
