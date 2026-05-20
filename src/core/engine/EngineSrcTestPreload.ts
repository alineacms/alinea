import {plugin} from 'bun'

plugin({
  name: 'engine-localdb-alias',
  setup(build) {
    build.module('alinea/core/db/LocalDB', async () => {
      return {
        exports: await import('./LocalDB.js'),
        loader: 'object'
      }
    })
  }
})
