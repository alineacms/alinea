import {Loader} from 'alinea/ui'
import dynamic from 'next/dynamic'
import {Suspense} from 'react'

const PlaygroundPage = dynamic(() => import('../view/Playground'), {
  ssr: false
})

export default function Playground() {
  return (
    <Suspense fallback={<Loader absolute />}>
      <PlaygroundPage />
    </Suspense>
  )
}
