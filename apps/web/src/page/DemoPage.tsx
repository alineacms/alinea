import {cms} from '@/cms'
import {Entry} from 'alinea/core/Entry'
import {Suspense} from 'react'
import {DemoPage} from './demo/layout/DemoPage'

export default async function Demo() {
  const entries = await cms.find({
    select: Entry,
    orderBy: {asc: Entry.level},
    location: cms.workspaces.demo
  })
  return (
    <Suspense>
      <DemoPage entries={entries} />
    </Suspense>
  )
}
