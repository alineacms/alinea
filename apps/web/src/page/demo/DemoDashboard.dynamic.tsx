'use client'

import dynamic from 'next/dynamic'

export const DemoPage = dynamic(() => import('./DemoDashboard'), {ssr: false})
