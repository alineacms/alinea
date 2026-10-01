import {
  detectPm,
  init,
  PM,
  patchAgents,
  patchClaude,
  patchGitignore,
  patchMcpConfig,
  patchPackageJson
} from '#/cli/Init.js'
import {suite} from '@alinea/suite'
import fs from 'node:fs/promises'
import path from 'node:path'

const testPms = false

async function setup(cwd: string) {
  await fs.rm(cwd, {recursive: true}).catch(() => {})
  await fs.mkdir(cwd, {recursive: true})
  await fs.writeFile(
    path.join(cwd, 'package.json'),
    '{"dependencies": {}, "scripts": {"dev": "next dev"}}'
  )
}

async function run(cwd: string) {
  await init({cwd, quiet: true, next: true})
}

const test = suite(import.meta)

if (testPms) {
  test('npm', async () => {
    const cwd = 'dist/.test/npm'
    await setup(cwd)
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      '{"dependencies": {}, "scripts": {}}'
    )
    await fs.writeFile(path.join(cwd, 'package-lock.json'), '{}')
    await run(cwd)
  })

  test('yarn', async () => {
    const cwd = 'dist/.test/yarn'
    await setup(cwd)
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      '{"dependencies": {}, "scripts": {}}'
    )
    await fs.writeFile(path.join(cwd, 'yarn.lock'), '')
    await run(cwd)
  })

  test('pnpm', async () => {
    const cwd = 'dist/.test/pnpm'
    await setup(cwd)
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      '{"dependencies": {}, "scripts": {}}'
    )
    await fs.writeFile(path.join(cwd, 'pnpm-lock.yaml'), '')
    await run(cwd)
  })
} else {
  test('init', async () => {
    const cwd = path.join(process.cwd(), 'dist/.init')
    await setup(cwd)
    await fs.mkdir(path.join(cwd, 'src'), {recursive: true})
    await run(cwd)
    const config = await fs.readFile(path.join(cwd, 'src/cms.ts'), 'utf-8')
    test.ok(config.includes("adminPath: '/admin'"))
    test.ok(config.includes("mediaDir: 'public/media'"))
    test.is(config.includes('mediaUrl'), false)
    test.is(config.includes('example.com'), false)
    const gitignore = await fs.readFile(path.join(cwd, '.gitignore'), 'utf-8')
    test.is(gitignore, '/public/admin.html\n/public/admin/\n')
    const agents = await fs.readFile(path.join(cwd, 'AGENTS.md'), 'utf-8')
    test.ok(agents.startsWith('<!-- BEGIN:alinea-agent-rules -->\n\n## Alinea\n'))
    test.ok(agents.includes('`src/cms.ts`'))
    test.ok(agents.includes('node_modules/alinea/docs/'))
    const claude = await fs.readFile(path.join(cwd, 'CLAUDE.md'), 'utf-8')
    test.is(claude, '@AGENTS.md\n')
    const mcp = await fs.readFile(path.join(cwd, '.mcp.json'), 'utf-8')
    test.equal(JSON.parse(mcp), {
      mcpServers: {alinea: {command: 'npx', args: ['alinea', 'mcp']}}
    })
  })
}

test('patchPackageJson keeps indentation', () => {
  const source =
    '{\n    "scripts": {\n        "dev": "next dev",\n        "build": "next build"\n    }\n}\n'
  const patched = patchPackageJson(source)!
  test.is(
    patched.source,
    '{\n    "scripts": {\n        "dev": "alinea dev -- next dev",\n        "build": "alinea build -- next build"\n    }\n}\n'
  )
})

test('patchPackageJson handles minified package.json', () => {
  const patched = patchPackageJson(
    '{"dependencies":{"next":"15"},"scripts":{"dev":"next dev"}}'
  )!
  test.is(
    patched.source,
    '{"dependencies":{"next":"15"},"scripts":{"dev":"alinea dev -- next dev"}}'
  )
})

test('patchPackageJson does not patch twice', () => {
  const source = '{"scripts":{"dev":"alinea dev -- next dev"}}'
  test.is(patchPackageJson(source)!.source, source)
  test.is(patchPackageJson('not json'), undefined)
})

test('patchGitignore appends missing lines', () => {
  const lines = ['/public/admin.html', '/public/admin/']
  test.is(patchGitignore('', lines), '/public/admin.html\n/public/admin/\n')
  test.is(
    patchGitignore('node_modules\r\n/public/admin/', lines),
    'node_modules\r\n/public/admin/\r\n/public/admin.html\r\n'
  )
  const source = '/public/admin/\n/public/admin.html\n'
  test.is(patchGitignore(source, lines), source)
})

const rules = '## Alinea\n\nUse the docs.\n'
const block =
  '<!-- BEGIN:alinea-agent-rules -->\n\n## Alinea\n\nUse the docs.\n\n<!-- END:alinea-agent-rules -->'

test('patchAgents appends the marked rules', () => {
  test.is(patchAgents('', rules), `${block}\n`)
  test.is(
    patchAgents('# Project\n\nRules.\n', rules),
    `# Project\n\nRules.\n\n${block}\n`
  )
  test.is(
    patchAgents('# Project\r\n', rules),
    `# Project\r\n\r\n${block.replaceAll('\n', '\r\n')}\r\n`
  )
})

test('patchAgents replaces the marked rules only', () => {
  const old =
    '# Project\n\n<!-- BEGIN:alinea-agent-rules -->\nOld.\n<!-- END:alinea-agent-rules -->\n\nOurs.\n'
  test.is(patchAgents(old, rules), `# Project\n\n${block}\n\nOurs.\n`)
  const current = `# Project\n\n${block}\n`
  test.is(patchAgents(current, rules), current)
})

test('patchClaude imports AGENTS.md', () => {
  test.is(patchClaude(undefined, rules), '@AGENTS.md\n')
  test.is(patchClaude('@AGENTS.md\n\nMore.\n', rules), '@AGENTS.md\n\nMore.\n')
  test.is(patchClaude('# Notes\n', rules), `# Notes\n\n${block}\n`)
})

test('patchMcpConfig adds the alinea server', () => {
  const server = {command: 'npx', args: ['alinea', 'mcp']}
  test.is(
    patchMcpConfig(undefined, server),
    '{\n  "mcpServers": {\n    "alinea": {\n      "command": "npx",\n      "args": [\n        "alinea",\n        "mcp"\n      ]\n    }\n  }\n}\n'
  )
  test.equal(
    JSON.parse(patchMcpConfig('{"mcpServers":{"other":{"command":"x"}}}', server)!),
    {mcpServers: {other: {command: 'x'}, alinea: server}}
  )
  const configured = '{"mcpServers":{"alinea":{"command":"bunx"}}}'
  test.is(patchMcpConfig(configured, server), configured)
  test.is(patchMcpConfig('not json', server), undefined)
})

test('detectPm detects bun.lock', async () => {
  const cwd = path.join(process.cwd(), 'dist/.init-pm')
  await fs.rm(cwd, {recursive: true}).catch(() => {})
  await fs.mkdir(cwd, {recursive: true})
  test.is(await detectPm(cwd), PM.NPM)
  await fs.writeFile(path.join(cwd, 'bun.lock'), '')
  test.is(await detectPm(cwd), PM.Bun)
})
