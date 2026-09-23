import {promises as fs} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {Loader} from '@/layout/Loader'
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
  // Resolve at runtime, alinea may be hoisted to the workspace root
  const require = createRequire(path.join(process.cwd(), 'package.json'))
  const alineaDir = path.dirname(require.resolve('alinea/package.json'))
  const declarations = await fs.readFile(
    path.join(alineaDir, 'dist/bundled.d.ts'),
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
