import {FSSource} from 'alinea/core/source/FSSource'
import {exportSource} from 'alinea/core/source/SourceExport'
import dynamic from 'next/dynamic.js'

const DemoDashboard = dynamic(() => import('./demo/DemoDashboard'), {
  ssr: false
})

const fs = new FSSource('content/demo')
const exported = await exportSource(fs)

export default async function Demo() {
  return <DemoDashboard exported={exported} />
}
