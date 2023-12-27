import {Loader} from 'alinea/ui'
import dynamic from 'next/dynamic'
import {Suspense} from 'react'

export const metadata = {
  title: 'Alinea CMS playground'
}

export const viewport = {
  themeColor: '#4a65e8'
}

const PlaygroundView = dynamic(() => import('./playground/Playground'), {
  ssr: false
})

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<Loader absolute />}>
      <PlaygroundView />
    </Suspense>
  )
}
