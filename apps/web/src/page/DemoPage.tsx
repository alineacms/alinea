import {FSSource} from 'alinea/core/source/FSSource'
import {exportSource} from 'alinea/core/source/SourceExport'
import {DemoDynamic} from './DemoDynamic'

const fs = new FSSource('content/demo')
const exported = await exportSource(fs)

export default async function Demo() {
  return <DemoDynamic exported={exported} />
}
