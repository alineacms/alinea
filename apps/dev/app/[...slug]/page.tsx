import {Entry} from 'alinea/core'
import {notFound} from 'next/navigation'
import {cms} from '@/cms'

export default async function Example(props: {
  params: Promise<{slug: Array<string>}>
}) {
  const slug = await props.params.then(({slug}) => slug)
  const url = `/${slug.join('/')}`
  const page = await cms.first({
    url,
    select: Entry
  })
  if (!page) return notFound()
  //const entry = await cms.get({url})
  return <div>{JSON.stringify(page)}</div>
}
