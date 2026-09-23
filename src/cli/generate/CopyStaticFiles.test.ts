import {generatedDatabaseFile} from '#/database/Version.js'
import {expect, test} from 'bun:test'
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {copyStaticFiles} from './CopyStaticFiles.js'

async function withPackage(run: (packageDir: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-generated-'))
  try {
    await run(directory)
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
}

test('copying static files removes databases from other Alinea versions', async () => {
  await withPackage(async packageDir => {
    const outDir = join(packageDir, 'site-0123456789')
    await mkdir(outDir, {recursive: true})
    const currentFiles = [
      generatedDatabaseFile,
      `${generatedDatabaseFile}-shm`,
      `${generatedDatabaseFile}-wal`
    ]
    const oldFiles = [
      'database.sqlite',
      'database-old-version.sqlite',
      'database-old-version.sqlite-shm',
      'database-old-version.sqlite-wal'
    ]
    await Promise.all(
      [...currentFiles, ...oldFiles].map(file =>
        writeFile(join(outDir, file), '')
      )
    )
    // Another project's database in the shared package is left alone
    await writeFile(join(packageDir, generatedDatabaseFile), '')

    await copyStaticFiles({cmd: 'dev', packageDir, outDir})

    const files = await readdir(outDir)
    expect(currentFiles.every(file => files.includes(file))).toBe(true)
    expect(oldFiles.every(file => !files.includes(file))).toBe(true)
    expect(await readdir(packageDir)).toContain(generatedDatabaseFile)
  })
})

test('a build points the runtime at its project, a dev server does not', async () => {
  await withPackage(async packageDir => {
    const siteA = join(packageDir, 'a-0000000000')
    const siteB = join(packageDir, 'b-1111111111')
    const runtime = () => readFile(join(packageDir, 'database.node.js'), 'utf8')

    await copyStaticFiles({cmd: 'dev', packageDir, outDir: siteA})
    expect(await runtime()).toContain(`./a-0000000000/${generatedDatabaseFile}`)

    await copyStaticFiles({cmd: 'build', packageDir, outDir: siteB})
    expect(await runtime()).toContain(`./b-1111111111/${generatedDatabaseFile}`)
    const release = await readFile(join(packageDir, 'release.js'), 'utf8')

    await copyStaticFiles({cmd: 'dev', packageDir, outDir: siteA})
    expect(await runtime()).toContain(`./b-1111111111/${generatedDatabaseFile}`)
    expect(await readFile(join(packageDir, 'release.js'), 'utf8')).toBe(release)

    const pkg = JSON.parse(
      await readFile(join(packageDir, 'package.json'), 'utf8')
    )
    expect(pkg.name).toBe('@alinea/generated')
    expect(pkg.exports['./database.node.js']).toBe('./database.node.js')
  })
})
