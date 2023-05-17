import {cms} from '../alinea.config'
import {BlogPost} from '../content/schema/BlogPost.jsx'
import {Doc} from '../content/schema/Doc'

export default async function Home() {
  const alleDitDocs = await cms.workspaces.main.pages.fetch({
    docMetDit: Doc({title: 'Dit'}).select({
      title: Doc.title
    }),
    blogPosts: BlogPost()
  })
  return <div>home page</div>
}
