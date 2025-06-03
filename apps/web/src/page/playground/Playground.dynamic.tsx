'use client'

import dynamic from 'next/dynamic'

export const PlaygroundDynamic = dynamic(() => import('./Playground'), {
  ssr: false
})
