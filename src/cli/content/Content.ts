import fs from 'node:fs/promises'
import {createServer} from 'node:http'
import type {AddressInfo} from 'node:net'
import path from 'node:path'
import {Config} from 'alinea/core/Config'
import type {UploadResponse} from 'alinea/core/Connection'
import {Entry} from 'alinea/core/Entry'
import {Field} from 'alinea/core/Field'
import {createId} from 'alinea/core/Id'
import {Root} from 'alinea/core/Root'
import {Schema} from 'alinea/core/Schema'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import type {CommitChange} from 'alinea/core/db/CommitRequest'
import type {UploadQuery} from 'alinea/core/db/Operation'
import {
  archive,
  create,
  discard,
  move,
  publish,
  remove,
  update,
  UnpublishOperation
} from 'alinea/core/db/Operation'
import type {Operation} from 'alinea/core/db/Operation'
import {createPreview} from 'alinea/core/media/CreatePreview'
import {Workspace} from 'alinea/core/Workspace'
import {basename, dirname, extname, join} from 'alinea/core/util/Paths'
import {generateNKeysBetween} from 'alinea/core/util/FractionalIndexing'
import {slugify} from 'alinea/core/util/Slugs'
import {generate} from '../Generate.js'
import {DevDB, type DevDBOptions} from '../generate/DevDB.js'

interface ContentArgs {
  config?: string
  dir?: string
  json?: boolean
}

interface JsonError {
  code: string
  message: string
  path?: string
  suggestion?: string
}

const entrySelection = {
  id: Entry.id,
  type: Entry.type,
  workspace: Entry.workspace,
  root: Entry.root,
  locale: Entry.locale,
  status: Entry.status,
  parentId: Entry.parentId,
  path: Entry.path,
  title: Entry.title,
  url: Entry.url,
  index: Entry.index,
  filePath: Entry.filePath,
  hasChildren: {
    edge: 'children',
    select: Entry.id,
    take: 1
  },
  data: Entry.data
} as const

const summarySelection = {
  id: Entry.id,
  type: Entry.type,
  workspace: Entry.workspace,
  root: Entry.root,
  locale: Entry.locale,
  status: Entry.status,
  parentId: Entry.parentId,
  path: Entry.path,
  title: Entry.title,
  url: Entry.url,
  hasChildren: {
    edge: 'children',
    select: Entry.id,
    take: 1
  }
} as const

const operationDocs = [
  {
    op: 'create',
    description: 'Create a new entry.',
    required: ['op', 'type', 'set'],
    optional: [
      'id',
      'workspace',
      'root',
      'parentId',
      'locale',
      'status',
      'insertOrder',
      'overwrite'
    ],
    notes: [
      'Use `content schema` to discover type names, roots, locales, and fields.',
      'For localized roots, include a locale from the target root i18n locales.',
      'If workspace/root are omitted, Alinea applies its normal defaults.'
    ],
    example: {
      op: 'create',
      type: 'Page',
      workspace: 'main',
      root: 'pages',
      locale: 'en',
      status: 'draft',
      set: {
        title: 'Example',
        path: 'example'
      }
    }
  },
  {
    op: 'update',
    description: 'Update fields on an existing entry version.',
    required: ['op', 'id', 'set'],
    optional: ['type', 'locale', 'status'],
    notes: [
      'Use `content list` or `content get` to discover entry ids.',
      'Status defaults to the published version when omitted by Alinea internals.'
    ],
    example: {
      op: 'update',
      id: 'entry-id',
      locale: 'en',
      status: 'draft',
      set: {
        title: 'Updated title'
      }
    }
  },
  {
    op: 'move',
    description: 'Move an entry to a different parent/root or reorder it.',
    required: ['op', 'id'],
    optional: ['after', 'toParent', 'toRoot'],
    notes: [
      'Use `content list` to discover the entry id, target parent id, and sibling ids.',
      '`after` is a sibling id in the destination. Use null or omit it to place first.',
      '`toParent` moves under another entry. `toRoot` moves to the root level of another root.',
      'Alinea validates parent existence, allowed child types, and impossible moves.'
    ],
    examples: [
      {
        label: 'Reorder within current parent',
        operation: {
          op: 'move',
          id: 'entry-id',
          after: 'previous-sibling-id'
        }
      },
      {
        label: 'Move under another parent',
        operation: {
          op: 'move',
          id: 'entry-id',
          toParent: 'target-parent-id',
          after: null
        }
      },
      {
        label: 'Move to root level',
        operation: {
          op: 'move',
          id: 'entry-id',
          toRoot: 'pages',
          after: null
        }
      }
    ]
  },
  {
    op: 'publish',
    description: 'Publish a draft or archived entry version.',
    required: ['op', 'id', 'status'],
    optional: ['locale'],
    allowed: {
      status: ['draft', 'archived']
    },
    example: {
      op: 'publish',
      id: 'entry-id',
      locale: 'en',
      status: 'draft'
    }
  },
  {
    op: 'archive',
    description: 'Archive an entry.',
    required: ['op', 'id'],
    optional: ['locale'],
    example: {
      op: 'archive',
      id: 'entry-id',
      locale: 'en'
    }
  },
  {
    op: 'unpublish',
    description: 'Turn a published entry into a draft.',
    required: ['op', 'id'],
    optional: ['locale'],
    example: {
      op: 'unpublish',
      id: 'entry-id',
      locale: 'en'
    }
  },
  {
    op: 'discard',
    description: 'Remove one status version of an entry.',
    required: ['op', 'id', 'status'],
    optional: ['locale'],
    allowed: {
      status: ['draft', 'archived', 'published']
    },
    example: {
      op: 'discard',
      id: 'entry-id',
      locale: 'en',
      status: 'draft'
    }
  },
  {
    op: 'remove',
    description: 'Remove an entry by id.',
    required: ['op', 'id'],
    optional: [],
    example: {
      op: 'remove',
      id: 'entry-id'
    }
  }
]

export async function schema(args: ContentArgs & {type?: string}) {
  return command(args, async () => {
    const {db} = await loadContent(args)
    const {config} = db
    const schema = args.type
      ? {[args.type]: getType(config, args.type)}
      : config.schema
    return ok({
      schema: {
        workspaces: Object.fromEntries(
          Object.entries(config.workspaces).map(([name, workspace]) => {
            const data = Workspace.data(workspace)
            return [
              name,
              {
                label: data.label,
                source: data.source,
                mediaDir: data.mediaDir,
                roots: Object.fromEntries(
                  Object.entries(Workspace.roots(workspace)).map(
                    ([name, root]) => {
                      const data = Root.data(root)
                      return [
                        name,
                        {
                          label: data.label,
                          i18n: data.i18n,
                          isMediaRoot: Root.isMediaRoot(root),
                          contains: Schema.contained(
                            config.schema,
                            Root.contains(root)
                          )
                        }
                      ]
                    }
                  )
                )
              }
            ]
          })
        ),
        types: Object.fromEntries(
          Object.entries(schema).map(([name, type]) => [
            name,
            {
              label: Type.label(type),
              hidden: Type.isHidden(type),
              contains: Schema.contained(config.schema, Type.contains(type)),
              insertOrder: Type.insertOrder(type),
              fields: describeFields(type)
            }
          ])
        )
      }
    })
  })
}

export async function operations(args: ContentArgs) {
  return command(args, async () =>
    ok({
      input: {
        accepted: ['json object', 'json array', 'ndjson', 'stdin'],
        commands: [
          'alinea content validate --input op.json',
          'alinea content apply --dry-run --input op.json',
          'alinea content apply --input op.json'
        ]
      },
      discovery: [
        'Run `alinea content schema --json` to discover workspaces, roots, locales, types, and fields.',
        'Run `alinea content list --json` to discover entry ids, parent ids, roots, locales, and sibling order.',
        'Run `alinea content get --id <entry-id> --json` before updating a specific entry.',
        'Run `alinea content validate --input op.json --json` before applying mutations.'
      ],
      operations: operationDocs
    })
  )
}

export async function get(args: ContentArgs & QueryArgs & {id: string}) {
  return command(args, async () => {
    assertArg(
      args.id,
      'MISSING_ENTRY_ID',
      'Missing entry id',
      'Pass --id <entry-id>. To discover entry ids, run `alinea content list --json`.'
    )
    const {db} = await loadContent(args)
    const entry = await db.get({
      id: args.id,
      locale: localeArg(args),
      status: statusArg(args, 'preferDraft'),
      select: entrySelection
    })
    return ok({entry: normalizeEntry(entry)})
  })
}

export async function list(args: ContentArgs & QueryArgs & ListArgs) {
  return command(args, async () => {
    const {db} = await loadContent(args)
    const type = args.type ? getType(db.config, args.type) : undefined
    const take = Number(args.limit ?? 50)
    const skip = Number(args.offset ?? 0)
    const includeData = args.includeData ?? args['include-data']
    const base = {
      type,
      workspace: args.workspace,
      root: args.root,
      parentId: parentIdArg(args),
      locale: localeArg(args),
      status: statusArg(args, 'preferPublished')
    }
    const page = {
      take,
      skip
    }
    const [entries, total] = await Promise.all([
      db.find({
        ...base,
        ...page,
        select: includeData ? entrySelection : summarySelection
      }),
      db.count(base)
    ])
    return ok({
      entries: entries.map(normalizeEntry),
      page: {limit: take, offset: skip, total}
    })
  })
}

export async function validate(args: ContentArgs & InputArgs) {
  return command(args, async () => {
    const {db} = await loadContent(args)
    const {operations, normalized} = await readOperations(db, args)
    const request = await dryRun(db, operations)
    return ok({
      normalized,
      changes: summarizeChanges(request.changes)
    })
  })
}

export async function apply(
  args: ContentArgs & InputArgs & {dryRun?: boolean}
) {
  return command(args, async () => {
    const {db} = await loadContent(args)
    const {operations, normalized} = await readOperations(db, args)
    if (dryRunArg(args)) {
      const request = await dryRun(db, operations)
      return ok({
        dryRun: true,
        normalized,
        changes: summarizeChanges(request.changes)
      })
    }
    await db.commit(...operations)
    return ok({sha: db.sha})
  })
}

export async function importMedia(
  args: ContentArgs &
    Pick<UploadQuery, 'workspace' | 'root' | 'parentId' | 'replaceId'> & {
      file?: string
      stdin?: boolean
      name?: string
      dryRun?: boolean
      preview?: boolean
    }
) {
  return command(args, async () => {
    assertArg(
      args.file || args.stdin,
      'MISSING_IMPORT_SOURCE',
      'Missing import file or --stdin',
      'Pass --file <path> to import a file from disk, or pipe bytes with --stdin --name <filename>.'
    )
    if (args.stdin)
      assertArg(
        args.name,
        'MISSING_IMPORT_NAME',
        'Missing --name for stdin import',
        'Pass --name <filename> when using --stdin so Alinea can infer media metadata from the file name and extension.'
      )
    const {cms, rootDir} = await loadContent(args)
    const file = await readImportFile(rootDir, args)
    const db = new ContentDB({
      config: cms.config,
      rootDir,
      dashboardUrl: undefined
    })
    if (dryRunArg(args)) {
      await db.sync()
      return ok({
        dryRun: true,
        file: {
          name: file.name,
          size: file.bytes.byteLength,
          source: file.source
        }
      })
    }
    const entry = await db.upload({
      file: [file.name, file.bytes],
      workspace: args.workspace,
      root: args.root,
      parentId: parentIdArg(args),
      replaceId: replaceIdArg(args),
      createPreview: args.preview === false ? undefined : createPreview
    })
    return ok({entry: normalizeEntry(entry)})
  })
}

export const upload = importMedia

interface QueryArgs {
  workspace?: string
  root?: string
  locale?: string
  status?: any
  parentId?: string | null
  'parent-id'?: string
  type?: string
}

interface ListArgs {
  limit?: string | number
  offset?: string | number
  includeData?: boolean
  'include-data'?: boolean
}

interface InputArgs {
  input?: string
}

async function loadContent(args: ContentArgs) {
  const cwd = args.dir ? path.resolve(args.dir) : process.cwd()
  const builds = generate({
    cmd: 'dev',
    cwd,
    configFile: args.config,
    quiet: true
  })
  const next = await builds.next()
  await builds.return(undefined)
  if (next.done) throw new Error('Could not load Alinea config')
  return {
    ...next.value,
    rootDir: cwd
  }
}

function describeFields(type: Type) {
  return Object.fromEntries(
    Type.sections(type)
      .flatMap(section => Object.entries(Section.fields(section)))
      .map(([name, field]) => {
        const options = Field.options(field)
        return [
          name,
          {
            label: Field.label(field),
            kind: fieldKind(field),
            required: Boolean(options.required),
            readOnly: Boolean(options.readOnly),
            hidden: Boolean(options.hidden),
            shared: Boolean(options.shared),
            initialValue: Field.initialValue(field),
            accepts: acceptedFormats(field),
            ...describeShape(Field.shape(field))
          }
        ]
      })
  )
}

function fieldKind(field: Field) {
  const shape = Field.shape(field)
  return shape.constructor.name.replace(/Shape$/, '')
}

function describeShape(shape: any): object {
  switch (shape.constructor.name) {
    case 'ListShape':
      return {
        rowTypes: describeRecordShapes(shape.shapes),
        rowSystemFields: ['_type', '_id', '_index'],
        rowRequiredFields: ['_type'],
        generatedFields: ['_id', '_index']
      }
    case 'UnionShape':
      return {
        types: describeRecordShapes(shape.shapes),
        systemFields: ['_type', '_id'],
        requiredFields: ['_type'],
        generatedFields: ['_id']
      }
    case 'RecordShape':
      return {
        fields: Object.keys(shape.shapes)
      }
  }
  return {}
}

function describeRecordShapes(shapes: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(shapes).map(([name, shape]) => [
      name,
      {
        fields: Object.keys(shape.shapes).filter(
          key => !['_id', '_index', '_type'].includes(key)
        )
      }
    ])
  )
}

function acceptedFormats(field: Field) {
  if (fieldKind(field) === 'RichText') return ['richTextJson']
  return ['json']
}

function getType(config: Config, type: string) {
  const instance = config.schema[type]
  assertArg(
    instance,
    'TYPE_NOT_FOUND',
    `Type not found: ${type}`,
    'Run `alinea content schema --json` to inspect the available type names.'
  )
  return instance
}

async function readOperations(db: DevDB, args: InputArgs) {
  const input = args.input
    ? await fs.readFile(args.input, 'utf8')
    : await readStdin()
  assertArg(
    input.trim().length > 0,
    'MISSING_JSON_INPUT',
    'Missing JSON input',
    'Pass --input <file.json>, pass --input <file.ndjson>, or pipe a JSON operation to stdin.'
  )
  const payload = parseJsonInput(input)
  const inputs = Array.isArray(payload) ? payload : [payload]
  const normalized = await Promise.all(
    inputs.map((operation, index) =>
      normalizeOperation(db, operation, `/${index}`)
    )
  )
  const operations = normalized.map((operation, index) =>
    toOperation(db.config, operation, `/${index}`)
  )
  return {operations, normalized}
}

function parseJsonInput(input: string) {
  try {
    return JSON.parse(input)
  } catch (error) {
    const lines = input
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
    if (lines.length <= 1) throw error
    return lines.map(line => JSON.parse(line))
  }
}

async function normalizeOperation(db: DevDB, input: any, path: string) {
  assertArg(
    input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_OPERATION',
    'Operation must be an object',
    'Pass a JSON object with an `op` property, or an array/NDJSON stream of operation objects.'
  )
  switch (input.op) {
    case 'create': {
      const typeName = required(input.type, `${path}/type`, {
        label: 'type',
        command:
          'Add `type` to the JSON operation payload. Run `alinea content schema --json` to inspect available type names.'
      })
      const type = getType(db.config, typeName)
      return {
        ...input,
        set: normalizeTypeSet(
          type,
          input.set ?? input.data ?? {},
          `${path}/set`,
          true
        )
      }
    }
    case 'update': {
      required(input.id, `${path}/id`, operationField('id'))
      const type = input.type
        ? getType(db.config, input.type)
        : await getEntryType(db, input, path)
      return {
        ...input,
        set: normalizeTypeSet(type, input.set ?? {}, `${path}/set`, false)
      }
    }
    default:
      return input
  }
}

function toOperation(config: Config, input: any, basePath: string): Operation {
  assertArg(
    input && typeof input === 'object',
    'INVALID_OPERATION',
    'Operation must be an object',
    'Pass a JSON object with an `op` property, or an array/NDJSON stream of operation objects.'
  )
  switch (input.op) {
    case 'create':
      required(input.type, `${basePath}/type`, {
        label: 'type',
        command:
          'Run `alinea content schema --json` to inspect available type names.'
      })
      return create({
        type: getType(config, input.type),
        id: input.id,
        workspace: input.workspace,
        root: input.root,
        parentId: input.parentId,
        locale: input.locale,
        status: input.status,
        insertOrder: input.insertOrder,
        overwrite: input.overwrite,
        set: input.set ?? input.data ?? {}
      })
    case 'update':
      return update({
        id: required(input.id, `${basePath}/id`, operationField('id')),
        type: input.type ? getType(config, input.type) : undefined,
        locale: input.locale,
        status: input.status,
        set: input.set ?? {}
      })
    case 'move':
      return move({
        id: required(input.id, `${basePath}/id`, operationField('id')),
        after: input.after,
        toParent: input.toParent,
        toRoot: input.toRoot
      })
    case 'publish':
      return publish({
        id: required(input.id, `${basePath}/id`, operationField('id')),
        status: required(
          input.status,
          `${basePath}/status`,
          operationField('status', 'Use "draft" or "archived" for publish.')
        ),
        locale: input.locale
      })
    case 'archive':
      return archive({
        id: required(input.id, `${basePath}/id`, operationField('id')),
        locale: input.locale
      })
    case 'unpublish':
      return new UnpublishOperation({
        id: required(input.id, `${basePath}/id`, operationField('id')),
        locale: input.locale
      })
    case 'discard':
      return discard({
        id: required(input.id, `${basePath}/id`, operationField('id')),
        status: required(
          input.status,
          `${basePath}/status`,
          operationField(
            'status',
            'Use "draft", "archived", or "published" for discard.'
          )
        ),
        locale: input.locale
      })
    case 'remove':
      return remove(required(input.id, `${basePath}/id`, operationField('id')))
    default:
      throw jsonError(
        'UNKNOWN_OPERATION',
        `Unknown operation: ${input.op}`,
        basePath,
        'Use one of: create, update, move, publish, archive, unpublish, discard, remove.'
      )
  }
}

async function getEntryType(db: DevDB, input: any, path: string) {
  try {
    const entry = await db.get({
      id: input.id,
      locale: input.locale,
      status: input.status ?? 'published',
      select: {type: Entry.type}
    })
    return getType(db.config, entry.type)
  } catch {
    throw jsonError(
      'ENTRY_NOT_FOUND',
      `Entry not found: ${input.id}`,
      `${path}/id`,
      'Run `alinea content list --json` to discover valid entry ids. If updating a draft or localized entry, include the matching `status` and `locale`.'
    )
  }
}

function normalizeTypeSet(
  type: Type,
  set: unknown,
  path: string,
  requireRequiredFields: boolean
) {
  assertPlainObject(
    set,
    path,
    'Field values must be provided as an object keyed by field name.'
  )
  const fields = typeFields(type)
  assertKnownKeys(set, fields, path)
  if (requireRequiredFields) {
    for (const [name, field] of Object.entries(fields)) {
      const options = Field.options(field)
      if (options.required && !(name in set)) {
        throw jsonError(
          'MISSING_VALUE',
          `Missing required field: ${name}`,
          `${path}/${name}`,
          `Add \`${name}\` to the \`set\` object. Run \`alinea content schema --type ${Type.label(
            type
          )} --json\` to inspect fields.`
        )
      }
    }
  }
  return Object.fromEntries(
    Object.entries(set).map(([name, value]) => [
      name,
      normalizeShape(Field.shape(fields[name]), value, `${path}/${name}`)
    ])
  )
}

function normalizeShape(shape: any, value: unknown, path: string): unknown {
  switch (shape.constructor.name) {
    case 'RecordShape':
      return normalizeRecordShape(shape, value, path)
    case 'ListShape':
      return normalizeListShape(shape, value, path)
    case 'UnionShape':
      return normalizeUnionShape(shape, value, path)
    case 'RichTextShape':
      if (!Array.isArray(value)) {
        throw jsonError(
          'INVALID_FIELD_VALUE',
          'Rich text fields must be an array of rich text nodes.',
          path,
          'Use native rich text JSON for this field. Run `alinea content schema --json` to inspect field formats.'
        )
      }
      return value
    default:
      return value
  }
}

function normalizeRecordShape(shape: any, value: unknown, path: string) {
  assertPlainObject(value, path, 'Record fields must be JSON objects.')
  assertKnownKeys(value, shape.shapes, path)
  return Object.fromEntries(
    Object.entries(value).map(([name, value]) => [
      name,
      normalizeShape(shape.shapes[name], value, `${path}/${name}`)
    ])
  )
}

function normalizeListShape(shape: any, value: unknown, path: string) {
  if (!Array.isArray(value)) {
    throw jsonError(
      'INVALID_FIELD_VALUE',
      'List fields must be arrays.',
      path,
      'Provide an array of row objects. Each row must include `_type`; `_id` and `_index` may be omitted and will be generated.'
    )
  }
  const keys = generateNKeysBetween(null, null, value.length)
  return value.map((row, index) => {
    const rowPath = `${path}/${index}`
    assertPlainObject(row, rowPath, 'List rows must be JSON objects.')
    const type = row._type
    if (!type) {
      throw jsonError(
        'MISSING_VALUE',
        'Missing list row _type',
        `${rowPath}/_type`,
        `Add \`_type\` to the row. Valid row types: ${Object.keys(
          shape.shapes
        ).join(', ')}.`
      )
    }
    const rowShape = shape.shapes[type]
    if (!rowShape) {
      throw jsonError(
        'UNKNOWN_FIELD_TYPE',
        `Unknown list row type: ${type}`,
        `${rowPath}/_type`,
        `Use one of: ${Object.keys(shape.shapes).join(', ')}.`
      )
    }
    assertKnownKeys(row, rowShape.shapes, rowPath)
    return {
      ...normalizeRecordShape(rowShape, row, rowPath),
      _id: row._id ?? createId(),
      _index: row._index ?? keys[index],
      _type: type
    }
  })
}

function normalizeUnionShape(shape: any, value: unknown, path: string) {
  assertPlainObject(value, path, 'Union fields must be JSON objects.')
  const type = value._type
  if (!type) {
    throw jsonError(
      'MISSING_VALUE',
      'Missing union _type',
      `${path}/_type`,
      `Add \`_type\`. Valid types: ${Object.keys(shape.shapes).join(', ')}.`
    )
  }
  const rowShape = shape.shapes[type]
  if (!rowShape) {
    throw jsonError(
      'UNKNOWN_FIELD_TYPE',
      `Unknown union type: ${type}`,
      `${path}/_type`,
      `Use one of: ${Object.keys(shape.shapes).join(', ')}.`
    )
  }
  assertKnownKeys(value, rowShape.shapes, path)
  return {
    ...normalizeRecordShape(rowShape, value, path),
    _id: value._id ?? createId(),
    _type: type
  }
}

function typeFields(type: Type) {
  return Object.assign(
    {},
    ...Type.sections(type).map(section => Section.fields(section))
  ) as Record<string, Field>
}

function assertPlainObject(
  value: unknown,
  path: string,
  suggestion: string
): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw jsonError(
      'INVALID_FIELD_VALUE',
      'Expected a JSON object.',
      path,
      suggestion
    )
  }
}

function assertKnownKeys(
  value: Record<string, any>,
  shapes: Record<string, unknown>,
  path: string
) {
  const expected = Object.keys(shapes)
  for (const key of Object.keys(value)) {
    if (!(key in shapes)) {
      throw jsonError(
        'UNKNOWN_FIELD',
        `Unknown field: ${key}`,
        `${path}/${key}`,
        `Remove \`${key}\` or replace it with one of the expected fields: ${expected.join(
          ', '
        )}.`
      )
    }
  }
}

async function dryRun(db: DevDB, operations: Array<Operation>) {
  const mutations = await Promise.all(
    operations.map(operation => operation.task(db))
  )
  await db.sync()
  return db.request(mutations.flat())
}

function summarizeChanges(changes: Array<CommitChange>) {
  return changes.map(change => ({
    op: change.op,
    path: 'path' in change ? change.path : change.location
  }))
}

function normalizeEntry(entry: any) {
  if (entry.hasChildren) entry.hasChildren = entry.hasChildren.length > 0
  return entry
}

function localeArg(args: QueryArgs) {
  if (!('locale' in args)) return undefined
  if (args.locale === undefined) return undefined
  if (args.locale === '' || args.locale === 'none' || args.locale === 'null')
    return null
  return args.locale
}

function statusArg(args: QueryArgs, fallback: string) {
  return args.status ?? fallback
}

function parentIdArg(args: {parentId?: string | null; 'parent-id'?: string}) {
  return args.parentId ?? args['parent-id']
}

function replaceIdArg(args: {replaceId?: string; 'replace-id'?: string}) {
  return args.replaceId ?? args['replace-id']
}

function dryRunArg(args: {dryRun?: boolean; 'dry-run'?: boolean}) {
  return args.dryRun ?? args['dry-run']
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function readImportFile(
  rootDir: string,
  args: {file?: string; stdin?: boolean; name?: string}
) {
  if (args.stdin) {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    return {
      name: args.name!,
      bytes: new Uint8Array(Buffer.concat(chunks)),
      source: 'stdin'
    }
  }
  const filePath = await resolveInputFile(rootDir, args.file!)
  return {
    name: path.basename(filePath),
    bytes: new Uint8Array(await fs.readFile(filePath)),
    source: filePath
  }
}

async function resolveInputFile(rootDir: string, file: string) {
  if (path.isAbsolute(file)) return file
  const fromRoot = path.resolve(rootDir, file)
  if (await exists(fromRoot)) return fromRoot
  return path.resolve(process.cwd(), file)
}

async function exists(file: string) {
  return fs.stat(file).then(
    () => true,
    () => false
  )
}

function ok<T extends object>(payload: T) {
  return {ok: true, ...payload}
}

async function command(args: ContentArgs, run: () => Promise<object>) {
  try {
    await writeJson(await run())
    process.exit(0)
  } catch (error) {
    await writeJson({
      ok: false,
      errors: [formatError(error)]
    })
    process.exit(1)
  }
}

function writeJson(value: object) {
  return new Promise<void>(resolve => {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`, () => resolve())
  })
}

interface RequiredOptions {
  label: string
  command: string
}

function required<T>(
  value: T | undefined,
  path: string,
  options: RequiredOptions
): T {
  if (value === undefined) {
    throw jsonError(
      'MISSING_VALUE',
      `Missing ${options.label}`,
      path,
      options.command
    )
  }
  return value
}

function operationField(label: string, extra?: string): RequiredOptions {
  return {
    label,
    command: [
      `Add \`${label}\` to the JSON operation payload.`,
      extra,
      'Run `alinea content schema --json` and `alinea content list --json` to discover valid values.'
    ]
      .filter(Boolean)
      .join(' ')
  }
}

function assertArg(
  value: unknown,
  code: string,
  message: string,
  suggestion?: string
): asserts value {
  if (!value) throw jsonError(code, message, undefined, suggestion)
}

function jsonError(
  code: string,
  message: string,
  path?: string,
  suggestion?: string
) {
  return Object.assign(new Error(message), {
    code,
    path,
    suggestion
  })
}

function formatError(error: any): JsonError {
  const hint = error?.suggestion ?? errorHint(error)
  return {
    code: error?.code ?? 'ERROR',
    message: error?.message ?? String(error),
    path: error?.path,
    suggestion: hint
  }
}

function errorHint(error: any) {
  const message = error?.message ?? String(error)
  if (message === 'No config file specified') {
    return 'Run this command from an Alinea project, pass --dir <project-dir>, or pass --config <path-to-config> relative to that project dir.'
  }
  if (message.startsWith('Type not found: ')) {
    return 'Run `alinea content schema --json` to inspect the available type names.'
  }
  if (message === 'Invalid locale') {
    return 'Run `alinea content schema --json` and use one of the locales listed on the target root. Use `--locale none` only for non-localized roots.'
  }
}

class ContentDB extends DevDB {
  #rootDir: string

  constructor(options: DevDBOptions) {
    super(options)
    this.#rootDir = options.rootDir
  }

  async prepareUpload(file: string): Promise<UploadResponse> {
    const entryId = createId()
    const dir = dirname(file)
    const extension = extname(file).toLowerCase()
    const name = basename(file, extension)
    const location = join(dir, `${slugify(name)}.${entryId}${extension}`)
    const fullPath = path.resolve(this.#rootDir, location)
    const serve = await listenForUpload(fullPath)
    return {
      entryId,
      location,
      previewUrl: '',
      url: serve.url
    }
  }
}

async function listenForUpload(file: string) {
  await fs.mkdir(path.dirname(file), {recursive: true})
  const server = createServer(async (req, res) => {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      await fs.writeFile(file, Buffer.concat(chunks))
      res.end()
    } catch {
      res.statusCode = 500
      res.end()
    } finally {
      server.close()
    }
  })
  return new Promise<{url: string}>(resolve => {
    server.listen(0, () => {
      const address = server.address() as AddressInfo
      resolve({url: `http://localhost:${address.port}`})
    })
  })
}
