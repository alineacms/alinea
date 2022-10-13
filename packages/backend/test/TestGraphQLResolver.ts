import {test} from 'uvu'
import {Pages} from '../src/Pages'
import createExample from './fixture/Example'

test('tree', async () => {
  const {config, store} = await createExample()
  const pages = new Pages({
    schema: config.schema,
    async query(cursor) {
      return store.all(cursor)
    }
  })
  console.log(
    await pages.graphql(`
      fragment Sub on Entry {
        id 
        title
      }
      {
        pages {
          id
          deTitel: title
          alinea {
            root
          }
          ...Sub
        }
        test2: pages {
          id
        }
      }
    `)
  )
})

test.run()
