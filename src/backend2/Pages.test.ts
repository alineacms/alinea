import {test} from 'uvu'
import {Pages} from './Pages.js'
import {Expr} from './pages/Expr.js'

interface BlogRoot {
  id: string
  title: string
}

interface BlogPost {
  title: string
  body: string
  tags: string[]
}

interface Tag {
  name: Expr<string>
}

type Schema = {
  BlogRoot: BlogRoot
  BlogPost: BlogPost
  Tag: Tag
}

const pages = new Pages<Schema>(async selection => {
  return selection as any
})

test('test', async () => {
  const {BlogPost, BlogRoot, Tag} = pages.types
  const root = BlogRoot().first()
  const entry = await pages({
    root,
    children: root.children(BlogPost()).with({
      tags: Tag(Tag.name.isIn(BlogPost.tags)).only(Tag.name)
    })
  })
  console.dir(entry, {depth: null})
})

test.run()
