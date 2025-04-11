import {suite} from '@alinea/suite'
import {Config, createConfig} from './Config.js'
import {workspace} from './Workspace.js'

const test = suite(import.meta)

test('content dir and file path of single workspace', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content',
        roots: {}
      })
    }
  })
  test.is(Config.contentDir(config), 'content')
  test.is(
    Config.filePath(config, 'main', 'root', null, 'file.txt'),
    'content/root/file.txt'
  )
})

test('content dir and file path of multiple workspaces', () => {
  const config2 = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {
        source: 'content/sub/main',
        roots: {}
      }),
      secondary: workspace('Main', {
        source: 'content/sub/secondary',
        roots: {}
      })
    }
  })
  test.is(Config.contentDir(config2), 'content/sub')
  test.is(
    Config.filePath(config2, 'main', 'root', null, 'file.txt'),
    'content/sub/main/root/file.txt'
  )
})
