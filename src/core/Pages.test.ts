import {Example} from 'alinea/backend/test/Example'
import {Pages} from 'alinea/core/Pages'
import {test} from 'uvu'

const {cms} = Example

test('test', async () => {
  const db = await Example.createDb()
  await db.init()
  await db.fill(Example.files())
  const pages = new Pages(Example.cms, db.find)
  const {TypeA} = cms.schema
  const entry = await pages(TypeA().select({title: TypeA.title}))
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
