import {test} from 'uvu'
import {createDb, files} from './Database.test.js'
import {Pages} from './Pages.js'

test('test', async () => {
  const db = await createDb()
  await db.fill(files())
  const pages = new Pages(db.resolve)
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
