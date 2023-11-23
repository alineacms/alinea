import {createId, outcome} from 'alinea/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import {generate} from './Generate.js'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'

const __dirname = dirname(import.meta.url)

export type InitOptions = {
  cwd?: string
  quiet?: boolean
}

enum PM {
  NPM = 'npm',
  Yarn = 'yarn',
  PNPM = 'pnpm',
  Bun = 'bun'
}

const lockfiles = {
  [PM.Bun]: 'bun.lockb',
  [PM.PNPM]: 'pnpm-lock.yaml',
  [PM.Yarn]: 'yarn.lock',
  [PM.NPM]: 'package-lock.json'
}

async function detectPm(): Promise<PM> {
  for (const [pm, lockFile] of Object.entries(lockfiles)) {
    if ((await outcome(fs.stat(lockFile))).isSuccess()) {
      return pm as PM
    }
  }
  return PM.NPM
}

export async function init(options: InitOptions) {
  const {cwd = process.cwd(), quiet = false} = options
  if ((await outcome(fs.stat(path.join(cwd, '.alinea')))).isSuccess()) {
    console.log(`> A folder named ".alinea" already exists in ${cwd}`)
    process.exit(1)
  }
  const configLocation = findConfigFile(cwd)
  if (configLocation) {
    console.log(`> An alinea config file already exists in ${cwd}`)
    process.exit(1)
  }
  await fs.mkdir(path.join(cwd, 'content/pages'), {recursive: true})
  await fs.writeFile(
    path.join(cwd, 'content/pages/welcome.json'),
    JSON.stringify(
      {
        id: createId(),
        type: 'Page',
        title: 'Welcome',
        alinea: {
          index: 'a0',
          seeded: true
        }
      },
      null,
      2
    )
  )
  await fs.mkdir(path.join(cwd, 'content/media'), {recursive: true})
  await fs.copyFile(
    path.join(__dirname, 'static/init/cms.js'),
    path.join(cwd, 'cms.ts')
  )
  const pm = await detectPm()
  /*const [pkg, err] = await outcome(
    fs
      .readFile(path.join(cwd, 'package.json'), 'utf-8')
      .then(contents => JSON.parse(contents))
  )
  if (pkg) {
    if (!pkg.dependencies) pkg.dependencies = {}
    pkg.dependencies['@alinea/generated'] = `${
      pm !== 'npm' ? 'link' : 'file'
    }:.alinea`
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify(pkg, null, 2)
    )
    await fs.mkdir(path.join(cwd, '.alinea'))
    const IS_WINDOWS =
      process.platform === 'win32' ||
      /^(msys|cygwin)$/.test(process.env.OSTYPE as string)
    const symlinkType = IS_WINDOWS ? 'junction' : 'dir'
    await outcome(
      fs.mkdir(path.join(cwd, 'node_modules/@alinea'), {recursive: true})
    )
    await outcome(
      fs.symlink(
        path.join(cwd, '.alinea'),
        path.join(cwd, 'node_modules/@alinea/generated'),
        symlinkType
      )
    )
    const installSucceeded = await outcome.succeeds(
      fs.stat(path.join(cwd, 'node_modules/@alinea/generated'))
    )
    if (!installSucceeded) execSync(`${pm} install`, {cwd, stdio: 'inherit'})
  }*/
  for await (const _ of generate({cwd: path.resolve(cwd), quiet})) {
  }
  const runner = pm === 'npm' ? 'npx' : pm
  const command = `${runner} alinea dev`
  if (!quiet)
    console.log(
      '> Alinea initialized. You can open the dashboard with `' + command + '`'
    )
}
