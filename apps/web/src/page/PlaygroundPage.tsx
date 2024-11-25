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

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<Loader absolute />}>
      <PlaygroundDynamic />
    </Suspense>
  )
}

PlaygroundPage.sitemap = (): MetadataRoute.Sitemap => {
  return [{url: '/playground', priority: 0.5}]
}
