import {generatedDatabaseFile} from '#/database/Version.js'
import {expect, test} from 'bun:test'
import path from 'node:path'
import {generatedPaths, projectDirName} from './GeneratedPaths.js'

const root = path.resolve('/repo')

test('the generated package sits next to an installed alinea package', () => {
  const {packageDir} = generatedPaths({
    alineaPackageDir: path.join(root, 'node_modules/alinea'),
    rootDir: path.join(root, 'apps/web'),
    configLocation: path.join(root, 'apps/web/cms.tsx')
  })
  expect(packageDir).toBe(path.join(root, 'node_modules/@alinea/generated'))
})

test('the generated package sits inside an alinea checkout', () => {
  const {packageDir} = generatedPaths({
    alineaPackageDir: root,
    rootDir: path.join(root, 'apps/dev'),
    configLocation: path.join(root, 'apps/dev/cms.tsx')
  })
  expect(packageDir).toBe(path.join(root, 'node_modules/@alinea/generated'))
})

test('projects sharing an alinea install get their own output', () => {
  const alineaPackageDir = path.join(root, 'node_modules/alinea')
  const web = generatedPaths({
    alineaPackageDir,
    rootDir: path.join(root, 'apps/web'),
    configLocation: path.join(root, 'apps/web/cms.tsx')
  })
  const dev = generatedPaths({
    alineaPackageDir,
    rootDir: path.join(root, 'apps/dev'),
    configLocation: path.join(root, 'apps/dev/cms.tsx')
  })
  expect(web.packageDir).toBe(dev.packageDir)
  expect(web.outDir).not.toBe(dev.outDir)
  expect(path.dirname(web.outDir)).toBe(web.packageDir)
  expect(web.databasePath).toBe(path.join(web.outDir, generatedDatabaseFile))
  expect(path.basename(web.outDir)).toMatch(/^web-[0-9a-f]{10}$/)
})

test('project directory names are stable and filesystem safe', () => {
  const a = projectDirName('/work/My Site!', '/work/My Site!/cms.ts')
  expect(a).toBe(projectDirName('/work/My Site!', '/work/My Site!/cms.ts'))
  expect(a).toMatch(/^my-site-[0-9a-f]{10}$/)
  expect(projectDirName('/work/site', '/work/site/src/cms.ts')).not.toBe(
    projectDirName('/work/site', '/work/site/cms.ts')
  )
  expect(projectDirName('/', '/cms.ts')).toMatch(/^project-[0-9a-f]{10}$/)
})
