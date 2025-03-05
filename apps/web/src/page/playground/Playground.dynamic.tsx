'use client'

import dynamic from 'next/dynamic'

export const Playground = dynamic(() => import('./Playground'), {
  ssr: false
})

export function PlaygroundDynamic(props) {
  return <Playground {...props} />
}
