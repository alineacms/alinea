import {Loader, Viewport} from '@alinea/ui'
import dynamic from 'next/dynamic'
import {Suspense} from 'react'

const DemoPage = dynamic(() => import('../view/Demo'), {
  ssr: false,
  suspense: true
})

export default function Demo() {
  return (
    <Suspense
      fallback={
        <Viewport color="">
          <Loader absolute />
        </Viewport>
      }
    >
      <DemoPage />
    </Suspense>
  )
}
