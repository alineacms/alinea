import {test} from 'uvu'
import {Pages} from './Pages.js'
import {Example} from './test/Example.js'

const {TypeA} = Example.schema

test('test', async () => {
  const db = await Example.createDb()
  await db.init()
  await db.fill(Example.files())
  const pages = new Pages(Example.schema, db.resolve)
  const entry = await pages(TypeA().get())
  console.dir(entry, {depth: null})
  // const entry1 = await pages(Type({id: 'root'}).get())

  /*const {BlogRoot, BlogPost, Tag} = pages.types
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

  console.dir(entry, {depth: null})*/
})

test.run()
