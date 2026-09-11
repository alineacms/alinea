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
    'root/file.txt'
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
    'main/root/file.txt'
  )
})

test('requires an explicitly configured handler URL', () => {
  const config = createConfig({
    schema: {},
    workspaces: {
      main: workspace('Main', {source: 'content', roots: {}})
    }
  })
  test.throws(() => Config.handlerUrl(config), 'Missing handlerUrl')
  test.is(Config.handlerUrl({...config, handlerUrl: '/custom'}), '/custom')
})

test('derives legacy dashboard settings from adminPath', () => {
  const config = createConfig({
    adminPath: 'cms',
    schema: {},
    workspaces: {
      main: workspace('Main', {source: 'content', roots: {}})
    }
  })
  test.is(Config.adminPath(config), '/cms')
  test.is(Config.dashboardFile(config), 'cms.html')
  test.is(
    Config.filePathname(config, 'nested/file.jpg'),
    '/cms/file/nested/file.jpg'
  )
})

test('derives adminPath from legacy dashboardFile', () => {
  const config = createConfig({
    dashboardFile: 'legacy.html',
    schema: {},
    workspaces: {
      main: workspace('Main', {source: 'content', roots: {}})
    }
  })
  test.is(Config.adminPath(config), '/legacy')
  test.is(Config.dashboardFile(config), 'legacy.html')
})

test('adminPath takes precedence over legacy dashboardFile', () => {
  const config = createConfig({
    adminPath: '/cms',
    dashboardFile: 'legacy.html',
    schema: {},
    workspaces: {
      main: workspace('Main', {source: 'content', roots: {}})
    }
  })
  test.is(Config.adminPath(config), '/cms')
  test.is(Config.dashboardFile(config), 'cms.html')
})
