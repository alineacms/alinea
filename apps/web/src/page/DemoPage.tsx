import {FSSource} from 'alinea/core/source/FSSource'
import {exportSource} from 'alinea/core/source/SourceExport'
import type {Metadata, MetadataRoute} from 'next'
import {getMetadata} from '@/utils/metadata'
import {DemoDynamic} from './DemoDynamic'

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata({
    url: '/demo',
    title: 'Demo',
    description:
      'Try the Alinea dashboard in your browser, editing the content of an example website.'
  })
}

export default async function Demo() {
  // Export per render rather than at module load: the page is static in
  // production, and in development content edits show up without a restart
  const exported = await exportSource(new FSSource('content/demo'))
  return <DemoDynamic exported={exported} />
}

Demo.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/demo', priority: 0.5}]
}
