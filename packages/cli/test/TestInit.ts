import {Pages} from '@alinea/backend/Pages'
import {init} from '@alinea/cli/Init'
import {Entry} from '@alinea/core/Entry'
import fs from 'fs-extra'
import path from 'path'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

test('init', async () => {
  const cwd = 'dist/.init'
  await fs.remove(cwd)
  await init({cwd, quiet: true})
  const exports = await import(
    `file://${path.resolve(cwd, '.alinea/main/pages')}`
  )
  const pages: Pages<Entry> = exports.pages
  const welcome = await pages.findFirst(page => page.title.is('Welcome'))
  assert.ok(welcome)
})

test.run()
