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
  const {BlogRoot, BlogPost, Tag} = pages.types
  const entry = await pages(
    BlogRoot().get({
      ...BlogRoot,
      test({children}) {
        return children()
      },
      posts({children}) {
        return children(BlogPost).select({
          ...BlogPost,
          tags() {
            return Tag(Tag.name.isIn(BlogPost.tags))
          },
          previousPost({previous}) {
            return previous(BlogPost).select({title: BlogPost.title})
          },
          nextPost({next}) {
            return next(BlogPost).select({title: BlogPost.title})
          }
        })
      }
    })
  )

  console.dir(entry, {depth: null})
})

test.run()
