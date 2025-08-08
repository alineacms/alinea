import fs from 'node:fs/promises'
import path from 'node:path'
import {createId} from 'alinea/core/Id'
import {outcome} from 'alinea/core/Outcome'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {reportFatal} from './util/Report.js'

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
    const [, error] = await outcome(fs.stat(lockFile))
    if (!error) {
      return pm as PM
    }
  }
  return PM.NPM
}

export async function init(options: InitOptions) {
  const {cwd = process.cwd(), quiet = false} = options
  const configLocation = findConfigFile(cwd)
  if (configLocation) {
    reportFatal(`An alinea config file already exists in ${cwd}`)
    process.exit(1)
  }
  await fs.mkdir(path.join(cwd, 'content/pages'), {recursive: true})
  await fs.writeFile(
    path.join(cwd, 'content/pages/welcome.json'),
    JSON.stringify(
      {
        _id: createId(),
        _type: 'Page',
        _index: 'a0',
        _seeded: 'welcome.json',
        title: 'Welcome'
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
  const pm = await detectPm()
  const runner = pm === 'npm' ? 'npx' : pm
  let [pkg] = await outcome(
    fs.readFile(path.join(cwd, 'package.json'), 'utf-8')
  )
  if (pkg) {
    pkg = pkg.replace('"dev": "', '"dev": "alinea dev -- ')
    pkg = pkg.replace('"build": "', '"build": "alinea build -- ')
    await fs.writeFile(path.join(cwd, 'package.json'), pkg)
    try {
      const isNext = JSON.parse(pkg).dependencies?.next
      if (isNext) options.next = true
    } catch {}
  }
  const isNext = options.next ?? false
  const configFileContents = isNext
    ? configFile.replaceAll('alinea/core', 'alinea/next')
    : configFile
  const hasSrcDir = await fs.access(path.join(cwd, 'src')).then(
    () => true,
    () => false
  )
  const installInto = hasSrcDir ? path.join(cwd, 'src') : cwd
  const configFileLocation = path.join(installInto, 'cms.ts')
  await fs.writeFile(configFileLocation, configFileContents)
  if (isNext) {
    const handlerFile = await fs.readFile(
      path.join(__dirname, 'static/init/next-handler.js'),
      'utf-8'
    )
    const routeLocation = path.join(
      installInto,
      'app/(alinea)/api/cms/route.ts'
    )
    await fs.mkdir(path.dirname(routeLocation), {recursive: true})
    await fs.writeFile(routeLocation, handlerFile)
  }
  const command = `${runner} alinea dev`
  if (!quiet)
    console.info(
      `Alinea initialized. You can open the dashboard with \`${command}\``
    )
}
