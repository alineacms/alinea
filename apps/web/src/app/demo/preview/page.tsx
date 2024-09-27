import {cms} from '@/cms'
import {DemoHomePage} from '@/page/demo/DemoHomePage'

export default async function DemoPage() {
  const props = await cms.get(DemoHomePage.fragment)
  return <DemoHomePage {...props} />
}
