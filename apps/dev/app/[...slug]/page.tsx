import {Entry} from 'alinea/core'
import {cms} from '@/cms'

export default async function Example(props: {
  params: Promise<{slug: Array<string>}>
}) {
  const slug = await props.params.then(({slug}) => slug)
  const url = `/${slug.join('/')}`
  const page = await cms.get({
    url,
    select: Entry
  })
  //const entry = await cms.get({url})
  return <div>{JSON.stringify(page)}</div>
}
