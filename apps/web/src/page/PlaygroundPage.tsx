import {promises as fs} from 'node:fs'
import {Loader} from 'alinea/ui'
import type {Metadata, MetadataRoute, Viewport} from 'next'
import {Suspense} from 'react'
import {getMetadata, type MetadataProps} from '@/utils/metadata'
import {PlaygroundDynamic} from './playground/Playground.dynamic'

export const viewport: Viewport = {
  themeColor: '#3f61e8'
}

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata({
    url: '/playground',
    title: 'Playground',
    metadata: {
      description:
        'Try out different field types and validation rules. Experiment, test, and preview field configurations in real-time.'
    }
  } as MetadataProps)
}
export default async function PlaygroundPage() {
  const declarations = await fs.readFile(
    `${process.cwd()}/dist/bundled.d.ts`,
    'utf8'
  )
  return (
    <Suspense fallback={<Loader absolute />}>
      <PlaygroundDynamic declarations={declarations} />
    </Suspense>
  )
}

PlaygroundPage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/playground', priority: 0.5}]
}
