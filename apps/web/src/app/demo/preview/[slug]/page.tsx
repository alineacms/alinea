import {cms} from '@/cms'
import {DemoRecipePage} from '@/page/demo/DemoRecipePage'

export default async function DemoSlug({params}) {
  const props = await cms.get(DemoRecipePage.fragment.wherePath(params.slug))
  return <DemoRecipePage {...props} />
}
