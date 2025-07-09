'use client'
import dynamic from 'next/dynamic'

export default dynamic(() => import('./admin').then(mod => mod.Admin), {
  ssr: false,
  loading: () => <div>Loading admin...</div>
})
