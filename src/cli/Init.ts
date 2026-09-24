import fs from 'node:fs/promises'
import path from 'node:path'
import {createId} from '#/core/Id.js'
import {outcome} from '#/core/Outcome.js'
import {isRecord} from '#/core/util/Objects.js'
import {dirname} from './util/Dirname.js'
import {findConfigFile} from './util/FindConfigFile.js'
import {reportFatal} from './util/Report.js'

const __dirname = dirname(import.meta.url)

export interface InitOptions {
  cwd?: string
  quiet?: boolean
  next?: boolean
}

export enum PM {
  NPM = 'npm',
  Yarn = 'yarn',
  PNPM = 'pnpm',
  Bun = 'bun'
}

const lockfiles: Array<[PM, string]> = [
  [PM.Bun, 'bun.lock'],
  [PM.Bun, 'bun.lockb'],
  [PM.PNPM, 'pnpm-lock.yaml'],
  [PM.Yarn, 'yarn.lock'],
  [PM.NPM, 'package-lock.json']
]

export async function detectPm(cwd = process.cwd()): Promise<PM> {
  for (const [pm, lockFile] of lockfiles) {
    const [, error] = await outcome(fs.stat(path.join(cwd, lockFile)))
    if (!error) return pm
  }
  return PM.NPM
}

function detectIndent(source: string): string {
  // A minified package.json (no indented lines) stays minified
  return source.match(/\n([ \t]+)\S/)?.[1] ?? ''
}

export interface PatchedPackageJson {
  source: string
  pkg: Record<string, unknown>
}

/**
 * Prefix the dev and build scripts of a package.json with the alinea
 * commands, keeping the original indentation. Returns the new source and the
 * parsed package, or undefined if the source is not valid JSON.
 */
export function patchPackageJson(
  source: string
): PatchedPackageJson | undefined {
  let pkg: unknown
  try {
    pkg = JSON.parse(source)
  } catch {
    return undefined
  }
  if (!isRecord(pkg)) return undefined
  const scripts = pkg.scripts
  if (isRecord(scripts)) {
    for (const name of ['dev', 'build'] as const) {
      const script = scripts[name]
      if (typeof script !== 'string' || script.includes('alinea ')) continue
      scripts[name] = `alinea ${name} -- ${script}`
    }
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  let result = JSON.stringify(pkg, null, detectIndent(source))
  if (newline !== '\n') result = result.replaceAll('\n', newline)
  if (source.endsWith(newline)) result += newline
  return {source: result, pkg}
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
  const pm = await detectPm(cwd)
  const runner = pm === 'npm' ? 'npx' : pm
  const packageFile = path.join(cwd, 'package.json')
  const [source] = await outcome(fs.readFile(packageFile, 'utf-8'))
  const patched = source ? patchPackageJson(source) : undefined
  if (patched) {
    await fs.writeFile(packageFile, patched.source)
    const dependencies = patched.pkg.dependencies
    if (isRecord(dependencies) && dependencies.next) options.next = true
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
