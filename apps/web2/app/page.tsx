import {cms} from '../alinea.config'

export default async function Home() {
  const home = await cms.workspaces.main.pages.fetch(
    cms.schema.HomePage().first()
  )
  return <div>home page</div>
}
