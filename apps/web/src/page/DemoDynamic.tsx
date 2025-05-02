'use client'

import dynamic from 'next/dynamic'

export const DemoDynamic = dynamic(() => import('./demo/DemoDashboard'), {
  ssr: false
})
