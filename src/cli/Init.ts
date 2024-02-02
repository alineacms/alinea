import {createId, outcome} from 'alinea/core'
import fs from 'node:fs/promises'
import path from 'node:path'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'

const __dirname = dirname(import.meta.url)

export type InitOptions = {
  cwd?: string
  quiet?: boolean
  next?: boolean
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
          seeded: 'welcome.json'
        }
      },
      null,
      2
    )
  )
  await fs.mkdir(path.join(cwd, 'content/media'), {recursive: true})
  const configFile = await fs.readFile(
    path.join(__dirname, 'static/init/cms.js'),
    'utf-8'
  )
  const configFileContents = options.next
    ? configFile.replaceAll('alinea/core', 'alinea/next')
    : configFile
  const hasSrcDir = (await outcome(fs.stat(path.join(cwd, 'src')))).isSuccess()
  const configFileLocation = path.join(
    cwd,
    hasSrcDir ? 'src/cms.tsx' : 'cms.tsx'
  )
  await fs.writeFile(configFileLocation, configFileContents)
  const pm = await detectPm()
  if (options.next) {
    let [pkg] = await outcome(
      fs.readFile(path.join(cwd, 'package.json'), 'utf-8')
    )
    if (pkg) {
      pkg = pkg.replace('"dev": "', '"dev": "alinea dev -- ')
      pkg = pkg.replace('"build": "', '"build": "alinea build -- ')
      await fs.writeFile(path.join(cwd, 'package.json'), pkg)
    }
  }
  const runner = pm === 'npm' ? 'npx' : pm
  const command = `${runner} alinea dev`
  if (!quiet)
    console.log(
      'Alinea initialized. You can open the dashboard with `' + command + '`'
    )
}
