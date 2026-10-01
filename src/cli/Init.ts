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

const dashboardOutput = ['/public/admin.html', '/public/admin/']

/**
 * Append the lines that are not yet in a .gitignore source, keeping its line
 * endings.
 */
export function patchGitignore(source: string, lines: Array<string>): string {
  const existing = new Set(source.split(/\r?\n/).map(line => line.trim()))
  const missing = lines.filter(line => !existing.has(line))
  if (missing.length === 0) return source
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const separator = source && !source.endsWith('\n') ? newline : ''
  return source + separator + missing.join(newline) + newline
}

const agentRulesStart = '<!-- BEGIN:alinea-agent-rules -->'
const agentRulesEnd = '<!-- END:alinea-agent-rules -->'

/**
 * Write the Alinea rules between their markers in an AGENTS.md source: in
 * place of the marked block when there is one, appended otherwise. Content
 * outside the markers stays as it is.
 */
export function patchAgents(source: string, rules: string): string {
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const block =
    `${agentRulesStart}\n\n${rules.trim()}\n\n${agentRulesEnd}`.replaceAll(
      '\n',
      newline
    )
  const start = source.indexOf(agentRulesStart)
  const end = source.indexOf(agentRulesEnd, start)
  if (start !== -1 && end !== -1)
    return (
      source.slice(0, start) + block + source.slice(end + agentRulesEnd.length)
    )
  if (!source.trim()) return block + newline
  return `${source.trimEnd()}${newline}${newline}${block}${newline}`
}

/**
 * Claude Code reads CLAUDE.md rather than AGENTS.md: a new one imports
 * AGENTS.md, an existing one that doesn't gets the rules themselves.
 */
export function patchClaude(source: string | undefined, rules: string) {
  if (source === undefined) return '@AGENTS.md\n'
  if (source.includes('@AGENTS.md')) return source
  return patchAgents(source, rules)
}

/**
 * Add the alinea server to a .mcp.json source, keeping one that is already
 * configured. Returns undefined if the source is not a JSON object.
 */
export function patchMcpConfig(
  source: string | undefined,
  server: {command: string; args: Array<string>}
): string | undefined {
  let config: unknown = {}
  try {
    if (source) config = JSON.parse(source)
  } catch {
    return undefined
  }
  if (!isRecord(config)) return undefined
  const servers = isRecord(config.mcpServers) ? config.mcpServers : {}
  if (source && servers.alinea) return source
  const result = {...config, mcpServers: {...servers, alinea: server}}
  const indent = source ? detectIndent(source) : '  '
  return `${JSON.stringify(result, null, indent)}\n`
}

/** Write the patched contents of a file, if they changed */
async function patchFile(
  file: string,
  patch: (source: string | undefined) => string | undefined
) {
  const [source] = await outcome(fs.readFile(file, 'utf-8'))
  const patched = patch(source)
  if (patched !== undefined && patched !== source)
    await fs.writeFile(file, patched)
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
  // Point coding agents to the docs and the MCP server
  const cmsFile = path.relative(cwd, configFileLocation).replaceAll('\\', '/')
  const rules = (
    await fs.readFile(path.join(__dirname, 'static/init/agents.md'), 'utf-8')
  ).replace('{cmsFile}', cmsFile)
  await patchFile(path.join(cwd, 'AGENTS.md'), source =>
    patchAgents(source ?? '', rules)
  )
  await patchFile(path.join(cwd, 'CLAUDE.md'), source =>
    patchClaude(source, rules)
  )
  await patchFile(path.join(cwd, '.mcp.json'), source =>
    patchMcpConfig(source, {
      command: pm === PM.Bun ? 'bunx' : 'npx',
      args: ['alinea', 'mcp']
    })
  )
  // alinea build writes the dashboard to the public folder
  await patchFile(path.join(cwd, '.gitignore'), source =>
    patchGitignore(source ?? '', dashboardOutput)
  )
  if (quiet) return
  const command = `${runner} alinea dev`
  console.info(
    `Alinea initialized. You can open the dashboard with \`${command}\``
  )
  if (isNext)
    console.info(
      "Wrap your Next.js config with `withAlinea` from 'alinea/next' to serve the dashboard on /admin"
    )
  console.info(
    'Set `baseUrl.production` in cms.ts to the URL of your site, on Vercel it is read from the environment'
  )
}
