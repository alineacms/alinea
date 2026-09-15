import {spawn} from 'node:child_process'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {suite} from '@alinea/suite'

const test = suite(import.meta)
const cwd = process.cwd()
const appDir = 'apps/dev'

interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  json: any
}

test('schema outputs workspaces roots locales and fields', async () => {
  const result = await runContent('schema', '--dir', appDir, '--type', 'Page')

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.equal(result.json.schema.workspaces.primary.roots.pages.i18n.locales, [
    'en',
    'fr',
    'nl-BE',
    'nl-NL'
  ])
  test.is(result.json.schema.types.Page.fields.title.required, true)
})

test('schema documents list row types and generated fields', async () => {
  const result = await runContent(
    'schema',
    '--dir',
    appDir,
    '--type',
    'ListFields'
  )
  const list = result.json.schema.types.ListFields.fields.list

  test.is(result.code, 0)
  test.equal(Object.keys(list.rowTypes), ['Text', 'Image'])
  test.equal(list.rowTypes.Text.fields, ['title', 'text'])
  test.equal(list.rowRequiredFields, ['_type'])
  test.equal(list.generatedFields, ['_id', '_index'])
})

test('content help points agents to discovery commands', async () => {
  const result = await runRaw(['src/cli.ts', 'content', '--help'])

  test.is(result.code, 0)
  test.ok(result.stdout.includes('content schema --json'))
  test.ok(result.stdout.includes('content list --json'))
  test.ok(result.stdout.includes('content operations --json'))
  test.ok(result.stdout.includes('content media import --file'))
})

test('operations documents move payloads', async () => {
  const result = await runContent('operations', '--json')
  const move = result.json.operations.find(
    (operation: any) => operation.op === 'move'
  )

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.equal(move.required, ['op', 'id'])
  test.equal(move.optional, ['after', 'toParent', 'toRoot'])
  test.ok(move.examples.some((example: any) => 'toParent' in example.operation))
})

test('missing config error explains how to specify one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'alinea-content-'))
  try {
    const result = await runContent('schema', '--dir', dir)

    test.is(result.code, 1)
    test.is(result.json.ok, false)
    test.is(result.json.errors[0].message, 'No config file specified')
    test.ok(result.json.errors[0].suggestion.includes('--config'))
    test.ok(result.json.errors[0].suggestion.includes('--dir'))
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('list filters localized entries and returns unpaginated total', async () => {
  const result = await runContent(
    'list',
    '--dir',
    appDir,
    '--workspace',
    'primary',
    '--root',
    'pages',
    '--locale',
    'en',
    '--type',
    'Page',
    '--limit',
    '1'
  )

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.is(result.json.entries.length, 1)
  test.is(result.json.entries[0].locale, 'en')
  test.ok(result.json.page.total > result.json.entries.length)
})

test('get can target non-localized entries explicitly', async () => {
  const list = await runContent(
    'list',
    '--dir',
    appDir,
    '--workspace',
    'primary',
    '--root',
    'fields',
    '--locale',
    'none',
    '--type',
    'Page',
    '--limit',
    '1'
  )
  const [entry] = list.json.entries
  const result = await runContent(
    'get',
    '--dir',
    appDir,
    '--id',
    entry.id,
    '--locale',
    'none'
  )

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.is(result.json.entry.id, entry.id)
  test.is(result.json.entry.locale, null)
})

test('missing entry id explains how to discover ids', async () => {
  const result = await runContent('get', '--dir', appDir)

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'MISSING_ENTRY_ID')
  test.ok(result.json.errors[0].suggestion.includes('content list'))
})

test('validate dry-runs localized create operation', async () => {
  const operation = {
    op: 'create',
    type: 'Page',
    workspace: 'primary',
    root: 'pages',
    locale: 'en',
    status: 'draft',
    set: {
      title: 'CLI Test',
      path: 'cli-test'
    }
  }
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify(operation)
  })

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.equal(result.json.changes, [
    {
      op: 'addContent',
      path: 'primary/pages/en/cli-test.draft.json'
    }
  ])
})

test('validate reports invalid locale as json error', async () => {
  const operation = {
    op: 'create',
    type: 'Page',
    workspace: 'primary',
    root: 'pages',
    locale: 'de',
    status: 'draft',
    set: {
      title: 'CLI Test',
      path: 'cli-test'
    }
  }
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify(operation)
  })

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].message, 'Invalid locale')
})

test('validate explains missing json input', async () => {
  const result = await runContent('validate', '--dir', appDir)

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'MISSING_JSON_INPUT')
  test.ok(result.json.errors[0].suggestion.includes('--input'))
})

test('validate explains missing operation fields', async () => {
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify({op: 'update', set: {title: 'Missing id'}})
  })

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'MISSING_VALUE')
  test.is(result.json.errors[0].path, '/0/id')
  test.ok(result.json.errors[0].suggestion.includes('content list'))
})

test('validate explains unknown operations', async () => {
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify({op: 'rename'})
  })

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'UNKNOWN_OPERATION')
  test.ok(result.json.errors[0].suggestion.includes('create'))
  test.ok(result.json.errors[0].suggestion.includes('remove'))
})

test('validate explains missing list row type', async () => {
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify({
      op: 'create',
      type: 'ListFields',
      workspace: 'primary',
      root: 'fields',
      set: {
        title: 'List CLI Test',
        path: 'list-cli-test',
        list: [{title: 'Missing row type'}]
      }
    })
  })

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'MISSING_VALUE')
  test.is(result.json.errors[0].path, '/0/set/list/0/_type')
  test.ok(result.json.errors[0].suggestion.includes('Text'))
})

test('validate explains unknown list row fields', async () => {
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify({
      op: 'create',
      type: 'ListFields',
      workspace: 'primary',
      root: 'fields',
      set: {
        title: 'List CLI Test',
        path: 'list-cli-test',
        list: [{_type: 'Text', title: 'Title', extra: true}]
      }
    })
  })

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'UNKNOWN_FIELD')
  test.is(result.json.errors[0].path, '/0/set/list/0/extra')
  test.ok(result.json.errors[0].suggestion.includes('title'))
  test.ok(result.json.errors[0].suggestion.includes('text'))
})

test('validate accepts list rows without id and index', async () => {
  const result = await runContent('validate', '--dir', appDir, {
    input: JSON.stringify({
      op: 'create',
      type: 'ListFields',
      workspace: 'primary',
      root: 'fields',
      set: {
        title: 'List CLI Test',
        path: 'list-cli-test',
        list: [{_type: 'Text', title: 'Generated fields', text: []}]
      }
    })
  })

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  const row = result.json.normalized[0].set.list[0]
  test.is(row._type, 'Text')
  test.ok(row._id)
  test.ok(row._index)
  test.equal(result.json.changes, [
    {
      op: 'addContent',
      path: 'primary/fields/list-cli-test.json'
    }
  ])
})

test('media import dry-runs from disk', async () => {
  const result = await runContent(
    'media',
    'import',
    '--dir',
    appDir,
    '--file',
    'src/test/fixtures/example.jpg',
    '--dry-run'
  )

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.is(result.json.file.name, 'example.jpg')
  test.is(result.json.file.size, 21005)
})

test('media import dry-runs from stdin', async () => {
  const result = await runContent(
    'media',
    'import',
    '--dir',
    appDir,
    '--stdin',
    '--name',
    'hello.txt',
    '--dry-run',
    {input: 'hello'}
  )

  test.is(result.code, 0)
  test.is(result.json.ok, true)
  test.is(result.json.file.name, 'hello.txt')
  test.is(result.json.file.size, 5)
  test.is(result.json.file.source, 'stdin')
})

test('media import stdin explains missing name', async () => {
  const result = await runContent(
    'media',
    'import',
    '--dir',
    appDir,
    '--stdin',
    '--dry-run',
    {input: 'hello'}
  )

  test.is(result.code, 1)
  test.is(result.json.ok, false)
  test.is(result.json.errors[0].code, 'MISSING_IMPORT_NAME')
  test.ok(result.json.errors[0].suggestion.includes('--name'))
})

function runContent(...args: Array<string | {input: string}>) {
  const last = args[args.length - 1]
  const options =
    typeof last === 'object' ? (args.pop() as {input: string}) : undefined
  return run(['src/cli.ts', 'content', ...(args as Array<string>)], options)
}

function run(args: Array<string>, options?: {input: string}) {
  return runRaw(args, options).then(result => {
    let json
    try {
      json = JSON.parse(result.stdout)
    } catch (error) {
      return Promise.reject(error)
    }
    return {...result, json}
  })
}

function runRaw(args: Array<string>, options?: {input: string}) {
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => (stdout += chunk))
    child.stderr.on('data', chunk => (stderr += chunk))
    child.on('error', reject)
    child.on('close', code => {
      resolve({code, stdout, stderr, json: undefined})
    })
    child.stdin.end(options?.input)
  })
}
