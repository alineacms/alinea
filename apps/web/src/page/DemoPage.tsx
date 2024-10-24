import {cms} from '@/cms'
import {Entry} from 'alinea/core/Entry'
import dynamic from 'next/dynamic'
import {Suspense} from 'react'

const DemoPage = dynamic(() => import('./demo/DemoDashboard'), {ssr: false})

export default async function Demo() {
  const entries = await cms.find({
    select: Entry,
    orderBy: {asc: Entry.level},
    filter: {
      _workspace: 'demo'
    }
  })
  return (
    <Suspense>
      <DemoPage entries={entries} />
    </Suspense>
  )
}
