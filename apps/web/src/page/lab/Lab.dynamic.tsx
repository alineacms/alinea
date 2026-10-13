'use client'

import dynamic from 'next/dynamic'

/** The lab runs workers and IndexedDB: it only renders in the browser. */
export const LabDynamic = dynamic(() => import('./LabLoader'), {ssr: false})
