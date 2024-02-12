import {cms} from '@/cms'
import {Query} from 'alinea'
import dynamic from 'next/dynamic'
import {Suspense} from 'react'

const DemoPage = dynamic(() => import('./DemoPage.client'), {ssr: false})

export default async function Demo() {
  const query = Query.whereWorkspace('demo').orderBy(Query.level.asc())
  const entries = await cms.find(query)
  return (
    <Suspense>
      <DemoPage entries={entries} />
    </Suspense>
  )
}
