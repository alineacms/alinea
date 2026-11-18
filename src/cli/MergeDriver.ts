import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import type {CMS} from '#/core/CMS.js'
import {Config} from '#/core/Config.js'
import {mergeEntryFiles} from '#/core/graft/MergeEntryFiles.js'
import {build} from 'esbuild'
import type {Side} from '@alinea/graft'
import {buildConfig} from './generate/CompileConfig.js'
import {generatedPaths} from './generate/GeneratedPaths.js'
import {findConfigFile} from './util/FindConfigFile.js'

/** The files git hands a merge driver: `%O %A %B %P` */
export interface DriverFiles {
  base: string
  ours: string
  theirs: string
  /** The path of the file in the repository */
  path: string
}

export interface DriverOptions {
  /** The content directory from the root of the repository */
  contentDir: string
  prefer?: Side
}

/**
 * Merges the three versions of an entry file git hands a merge driver into
 * `ours`, field by field as the server merges saves. It never conflicts.
 */
export async function mergeContentFile(
  config: Config,
  files: DriverFiles,
  {contentDir, prefer = 'ours'}: DriverOptions
): Promise<void> {
  const read = (file: string) =>
    fs.existsSync(file) && fs.statSync(file).size > 0
      ? new Uint8Array(fs.readFileSync(file))
      : undefined
  const ours = read(files.ours)
  const theirs = read(files.theirs)
  if (!ours || !theirs) return
  const mergeFile = mergeEntryFiles(config, {contentDir})
  const merged = await mergeFile(
    {path: files.path, base: read(files.base), ours, theirs},
    {prefer}
  )
  const result = merged ?? (prefer === 'ours' ? ours : theirs)
  fs.writeFileSync(files.ours, result)
}

export interface MergeDriverArgs {
  /** The project's root directory, from the root of the repository */
  dir?: string
  configFile?: string
  prefer?: Side
}

/** `alinea merge-driver %O %A %B %P`, run by git from the repository root */
export async function mergeDriver(
  files: DriverFiles,
  args: MergeDriverArgs
): Promise<void> {
  const repository = gitRoot(process.cwd())
  const rootDir = path.resolve(repository, args.dir ?? '.')
  const cms = await loadConfig(rootDir, args.configFile)
  await mergeContentFile(cms.config, files, {
    contentDir: contentDirIn(repository, rootDir, cms.config),
    prefer: args.prefer
  })
}

export interface InstallOptions {
  cwd?: string
  configFile?: string
  /** The command git runs, by default this alinea through node */
  command?: string
  /** The content directory, read from the config by default */
  contentDir?: string
}

/**
 * Lets `git merge` and `git pull` merge content as the server does: adds
 * `merge=alinea` for entry files to `.gitattributes` and the driver to the
 * repository's git config.
 */
export async function installMergeDriver(
  options: InstallOptions = {}
): Promise<{attributes: string; driver: string}> {
  const rootDir = fs.realpathSync(path.resolve(options.cwd ?? process.cwd()))
  const repository = gitRoot(rootDir)
  const dir = path.relative(repository, rootDir).replaceAll('\\', '/')
  const contentDir =
    options.contentDir ??
    contentDirIn(
      repository,
      rootDir,
      (await loadConfig(rootDir, options.configFile)).config
    )
  const pattern = `${contentDir ? `${contentDir}/` : ''}**/*.json merge=alinea`
  const attributesFile = path.join(repository, '.gitattributes')
  const current = fs.existsSync(attributesFile)
    ? fs.readFileSync(attributesFile, 'utf-8')
    : ''
  if (!current.split(/\r?\n/).includes(pattern)) {
    const separator = current === '' || current.endsWith('\n') ? '' : '\n'
    fs.writeFileSync(attributesFile, `${current}${separator}${pattern}\n`)
  }
  const flags = [
    dir && dir !== '.' ? ` --dir ${quote(dir)}` : '',
    options.configFile ? ` --config ${quote(options.configFile)}` : ''
  ].join('')
  const command = options.command ?? `node ${quote(cliPath(repository))}`
  const driver = `${command} merge-driver %O %A %B %P${flags}`
  git(repository, 'config', 'merge.alinea.name', 'Alinea content')
  git(repository, 'config', 'merge.alinea.driver', driver)
  return {attributes: pattern, driver}
}

function contentDirIn(repository: string, rootDir: string, config: Config) {
  const dir = path.resolve(rootDir, Config.contentDir(config))
  return path.relative(repository, dir).replaceAll('\\', '/')
}

function gitRoot(cwd: string): string {
  return fs.realpathSync(git(cwd, 'rev-parse', '--show-toplevel'))
}

function git(cwd: string, ...args: Array<string>): string {
  return execFileSync('git', args, {cwd, encoding: 'utf-8'}).trim()
}

function quote(value: string): string {
  return /^[\w./-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", `'\\''`)}'`
}

/** This alinea's command line, from the root of the repository */
function cliPath(repository: string): string {
  const require = createRequire(import.meta.url)
  const pkg = path.dirname(require.resolve('alinea/package.json'))
  return path.relative(repository, path.join(pkg, 'dist/cli.js'))
}

/**
 * Compiles the project's config next to the one `alinea dev` generates, so
 * its imports resolve, under a name of its own so a running dev server keeps
 * its own.
 */
async function loadConfig(rootDir: string, configFile?: string): Promise<CMS> {
  const configLocation = configFile
    ? path.resolve(rootDir, configFile)
    : findConfigFile(rootDir)
  if (!configLocation) throw new Error(`No Alinea config file in ${rootDir}`)
  const {outDir} = generatedPaths({rootDir, configLocation})
  const name = `merge-driver-${process.pid}`
  const outFile = path.join(outDir, `${name}.js`)
  try {
    await build({
      ...buildConfig(rootDir),
      logLevel: 'silent',
      outdir: outDir,
      entryPoints: {[name]: configLocation}
    })
    global.require = createRequire(import.meta.url)
    const exports = await import(pathToFileURL(outFile).href)
    if (!('cms' in exports)) throw new Error('No export named cms found')
    return exports.cms
  } finally {
    for (const file of fs.readdirSync(outDir))
      if (file.startsWith(name)) fs.rmSync(path.join(outDir, file))
  }
}
