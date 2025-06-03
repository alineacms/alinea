import {promises as fs} from 'node:fs'
import {Loader} from 'alinea/ui'
import type {MetadataRoute} from 'next'
import {Suspense} from 'react'
import {PlaygroundDynamic} from './playground/Playground.dynamic'

export const metadata = {
  title: 'Alinea CMS playground'
}

export const viewport = {
  themeColor: '#4a65e8'
}

export default async function PlaygroundPage() {
  const declarations = await fs.readFile(
    `${process.cwd()}/src/page/playground/alinea.d.ts.txt`,
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
