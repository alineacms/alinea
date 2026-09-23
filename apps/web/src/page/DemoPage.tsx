import {FSSource} from 'alinea/core/source/FSSource'
import {exportSource} from 'alinea/core/source/SourceExport'
import {DemoDynamic} from './DemoDynamic'

export default async function Demo() {
  // Export per render rather than at module load: the page is static in
  // production, and in development content edits show up without a restart
  const exported = await exportSource(new FSSource('content/demo'))
  return <DemoDynamic exported={exported} />
}
