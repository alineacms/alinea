import {Pages} from 'alinea/backend2/Pages'
import {Expr} from 'alinea/backend2/pages/Expr.js'
import {test} from 'uvu'

interface BlogRoot {
  id: Expr<string>
  title: Expr<string>
}

interface BlogPost {
  title: Expr<string>
  body: Expr<string>
  tags: Expr<string[]>
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
  const entry = await pages(BlogRoot, {
    root: BlogRoot,
    posts({children}) {
      return pages(children, {
        ...BlogPost,
        tags() {
          return pages(Tag(Tag.name.isIn(BlogPost.tags)))
        },
        previousPost({previous}) {
          return pages(previous, {
            title: BlogPost.title
          })
        },
        nextPost({next}) {
          return pages(next, {
            title: BlogPost.title
          })
        }
      })
    }
  })
  console.dir(entry, {depth: null})
})

test.run()
