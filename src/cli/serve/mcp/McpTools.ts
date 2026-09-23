import fs from 'node:fs/promises'
import path from 'node:path'
import {Config} from '#/core/Config.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import type {Field} from '#/core/Field.js'
import type {GraphQuery, Status} from '#/core/Graph.js'
import {getRoot} from '#/core/Internal.js'
import type {ImagePreviewDetails} from '#/core/media/CreatePreview.js'
import {isImage} from '#/core/media/IsImage.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Schema} from '#/core/Schema.js'
import {textDocToMarkdown} from '#/core/text/TextDocToMarkdown.js'
import type {TextDoc} from '#/core/TextDoc.js'
import {Type} from '#/core/Type.js'
import type {User} from '#/core/User.js'
import {entries, isRecord, keys} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import {Workspace} from '#/core/Workspace.js'
import {EntryInput, mergeTypeData} from './McpInput.js'
import {type JsonSchema, type McpTool, McpToolError} from './McpServer.js'
import {
  describeSchema,
  fieldBlocks,
  fieldKind,
  fieldLocalisation,
  fieldObjectType
} from './McpSchema.js'

export interface ContentToolsOptions {
  config: Config
  /** Reads and writes content, writes must take the dashboard's path */
  graph: WriteableGraph
  /** The project directory, local files can only be uploaded from here */
  rootDir: string
  /** The user recorded in metadata fields */
  user?: User
  createPreview?(blob: Blob): Promise<ImagePreviewDetails>
  fetch?: typeof globalThis.fetch
}

export const mcpInstructions = `Alinea is a git-based CMS: every entry is a JSON file in the project's content directory. Write content through these tools instead of editing the JSON files, they fill in internal fields (_id, _index, list row ids, rich text node shapes, media metadata) and the dashboard updates live.

Content model: workspaces contain roots (top-level sections, some translated into locales), roots contain entries in a tree. Every entry has a type which defines its fields; container types list which types they may contain. Media (images, files) live in a media root as MediaFile entries.

Workflow:
1. describe_schema once to learn the workspaces, roots, types and how to write each field kind (see valueFormats).
2. find_entries / get_entry to locate content, parents and ids.
3. create_entry / update_entry with data keyed by field. Rich text accepts Markdown; links accept entry ids; list rows need no _id/_index. Use upload_file first to get a media id for image or file fields.
4. Entries are published by default. Pass publish: false to save a draft when drafts are enabled.

Errors name the offending field path and what is expected, fix the data and retry.`

const statusValues = [
  'preferDraft',
  'preferPublished',
  'published',
  'draft',
  'archived',
  'all'
]

const summarySelection = {
  id: Entry.id,
  type: Entry.type,
  title: Entry.title,
  path: Entry.path,
  url: Entry.url,
  parentId: Entry.parentId,
  locale: Entry.locale,
  status: Entry.status,
  workspace: Entry.workspace,
  root: Entry.root
}

interface EntrySummary {
  id: string
  type: string
  title: string
  path: string
  url: string
  parentId: string | null
  locale: string | null
  status: EntryStatus
  workspace: string
  root: string
}

interface StoredEntry extends EntrySummary {
  filePath: string
  parents: Array<string>
  data: Record<string, unknown>
}

const storedSelection = {
  ...summarySelection,
  filePath: Entry.filePath,
  parents: Entry.parents,
  data: Entry.data
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key]
  return typeof value === 'string' && value ? value : undefined
}

function fail(message: string): never {
  throw new McpToolError(message)
}

const localeSchema: JsonSchema = {
  type: 'string',
  description:
    'Locale of the translation, for roots with i18n (see describe_schema). Defaults to the first locale of the root.'
}

export function createContentTools(
  options: ContentToolsOptions
): Array<McpTool> {
  const {config, graph, rootDir} = options
  const schema = config.schema
  const typeNames = Schema.typeNames(schema)

  function typeOf(name: string): Type {
    const type = schema[name]
    if (!type)
      fail(
        `Type "${name}" not found, available types: ${keys(schema).join(', ')}`
      )
    return type
  }

  function workspaceOf(name: string | undefined): [string, Workspace] {
    const names = keys(config.workspaces)
    const key = name ?? names[0]
    const workspace = config.workspaces[key]
    if (!workspace)
      fail(
        `Workspace "${key}" not found, available workspaces: ${names.join(', ')}`
      )
    return [key, workspace]
  }

  function rootOf(workspaceName: string, name: string | undefined) {
    const [, workspace] = workspaceOf(workspaceName)
    const roots = Workspace.roots(workspace)
    const key = name ?? Workspace.defaultRoot(workspace)
    const root = roots[key]
    if (!root)
      fail(
        `Root "${key}" not found in workspace "${workspaceName}", available roots: ${keys(roots).join(', ')}`
      )
    return {key, root, data: getRoot(root)}
  }

  function localeFor(
    workspaceName: string,
    rootName: string,
    locale: string | undefined
  ): string | null {
    const {data} = rootOf(workspaceName, rootName)
    const locales = data.i18n?.locales
    if (!locales) {
      if (locale)
        fail(`Root "${rootName}" is not translated, leave out the locale`)
      return null
    }
    if (!locale) return locales[0]
    if (!locales.includes(locale))
      fail(
        `Locale "${locale}" is not available in root "${rootName}", expected one of: ${locales.join(', ')}`
      )
    return locale
  }

  /** Entry file paths are relative to the content directory */
  function diskPath(entry: {filePath: string}) {
    return path.posix.join(Config.contentDir(config), entry.filePath)
  }

  function statusFor(publish: boolean, type: Type): 'published' | 'draft' {
    if (publish || type === MediaLibrary) return 'published'
    if (!config.enableDrafts)
      fail(
        'Drafts are not enabled in this config (enableDrafts), save with publish: true'
      )
    return 'draft'
  }

  async function checkReferences(input: EntryInput) {
    if (input.references.length === 0) return
    const ids = [...new Set(input.references.map(ref => ref.id))]
    const found = (await graph.find({
      id: {in: ids},
      status: 'preferDraft',
      select: {id: Entry.id, type: Entry.type}
    })) as Array<{id: string; type: string}>
    const types = new Map(found.map(entry => [entry.id, entry.type]))
    for (const ref of input.references) {
      const type = types.get(ref.id)
      if (!type)
        fail(
          `${ref.path}: entry "${ref.id}" does not exist, use find_entries to look up ids${ref.linkType === 'entry' ? '' : ' or upload_file to add media'}`
        )
      if (ref.linkType !== 'entry' && type !== 'MediaFile')
        fail(
          `${ref.path}: entry "${ref.id}" is a ${type}, ${ref.linkType} links need a media file (upload_file returns one)`
        )
    }
  }

  async function allowedChildTypes(
    workspace: string,
    root: string,
    parentId: string | null,
    locale: string | null
  ): Promise<{allowed: Array<string>; where: string}> {
    if (parentId) {
      const parent = (await graph.first({
        id: parentId,
        locale,
        status: 'preferDraft',
        select: {...summarySelection}
      })) as EntrySummary | null
      if (!parent)
        fail(
          locale
            ? `Parent "${parentId}" not found in locale "${locale}", translate or create the parent first`
            : `Parent "${parentId}" not found`
        )
      if (parent.workspace !== workspace || parent.root !== root)
        fail(
          `Parent "${parentId}" is in ${parent.workspace}/${parent.root}, not ${workspace}/${root}`
        )
      const parentType = schema[parent.type]
      const contains = parentType ? Type.contains(parentType) : []
      return {
        allowed: Schema.contained(schema, contains),
        where: `parent "${parent.title}" (${parent.type})`
      }
    }
    const {data} = rootOf(workspace, root)
    const contains = data.isMediaRoot
      ? ['MediaLibrary', 'MediaFile']
      : Schema.contained(schema, data.contains ?? [])
    return {allowed: contains, where: `root "${root}"`}
  }

  function renderRichText(type: Type, data: Record<string, unknown>) {
    const result: Record<string, unknown> = {...data}
    for (const [key, field] of entries(Type.fields(type)))
      if (key in result) result[key] = renderValue(field, result[key])
    return result
  }

  function renderValue(field: Field, value: unknown): unknown {
    switch (fieldKind(field)) {
      case 'richText': {
        if (!Array.isArray(value)) return value
        const blocks = fieldBlocks(field)
        const doc = (value as TextDoc).map(node => {
          const blockType = blocks[node._type]
          if (!blockType || !isRecord(node)) return node
          return renderRichText(blockType, node) as unknown as typeof node
        })
        return textDocToMarkdown(doc)
      }
      case 'list': {
        if (!Array.isArray(value)) return value
        const blocks = fieldBlocks(field)
        return value.map(row => {
          if (!isRecord(row) || typeof row._type !== 'string') return row
          const blockType = blocks[row._type]
          return blockType ? renderRichText(blockType, row) : row
        })
      }
      case 'object':
      case 'metadata': {
        const type = fieldObjectType(field)
        return type && isRecord(value) ? renderRichText(type, value) : value
      }
      case 'localised': {
        const localisation = fieldLocalisation(field)
        if (!localisation || !isRecord(value)) return value
        const result: Record<string, unknown> = {}
        for (const [locale, inner] of entries(value))
          result[locale] = renderValue(localisation.inner, inner)
        return result
      }
      default:
        return value
    }
  }

  async function childrenCounts(ids: Array<string>, locale?: string | null) {
    const counts = new Map<string, number>()
    if (ids.length === 0) return counts
    const children = (await graph.find({
      parentId: {in: ids},
      ...(locale !== undefined ? {locale} : {}),
      status: 'preferDraft',
      select: {id: Entry.id, parentId: Entry.parentId}
    })) as Array<{id: string; parentId: string}>
    const seen = new Set<string>()
    for (const child of children) {
      const key = `${child.parentId}:${child.id}`
      if (seen.has(key)) continue
      seen.add(key)
      counts.set(child.parentId, (counts.get(child.parentId) ?? 0) + 1)
    }
    return counts
  }

  async function loadEntry(
    id: string,
    locale: string | undefined,
    status: Status = 'preferDraft'
  ): Promise<StoredEntry> {
    const versions = (await graph.find({
      id,
      status,
      select: storedSelection
    })) as Array<StoredEntry>
    if (versions.length === 0)
      fail(`Entry "${id}" not found, use find_entries to look up ids`)
    if (locale) {
      const match = versions.find(version => version.locale === locale)
      if (!match)
        fail(
          `Entry "${id}" has no "${locale}" translation, available: ${versions.map(v => v.locale).join(', ')}. Use create_entry with translationOf to translate it`
        )
      return match
    }
    if (versions.length > 1)
      fail(
        `Entry "${id}" exists in several locales (${versions.map(v => v.locale).join(', ')}), pass a locale`
      )
    return versions[0]
  }

  function summary(entry: EntrySummary & {filePath?: string}) {
    const {filePath, ...rest} = entry
    return filePath ? {...rest, file: diskPath({filePath})} : rest
  }

  const tools: Array<McpTool> = [
    {
      name: 'describe_schema',
      title: 'Describe the content schema',
      description:
        'Describe workspaces, roots (with locales, allowed types and seeded children), entry types and their fields (kind, label, options, nested list/rich text block types, allowed child types) plus how to write values for each field kind. Call this first. Pass `type` to describe a single type and the blocks it uses.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Name of a type to describe, eg "Page"'
          }
        },
        additionalProperties: false
      },
      annotations: {readOnlyHint: true, openWorldHint: false},
      async call(args) {
        const type = stringArg(args, 'type')
        if (type) typeOf(type)
        return describeSchema({config, type})
      }
    },
    {
      name: 'find_entries',
      title: 'Find entries',
      description:
        'List entries matching filters, in tree order. Returns id, type, title, path, url, parentId, locale, status, workspace, root and childrenCount, plus the total number of matches.',
      inputSchema: {
        type: 'object',
        properties: {
          workspace: {type: 'string', description: 'Workspace name'},
          root: {type: 'string', description: 'Root name'},
          type: {type: 'string', description: 'Only entries of this type'},
          parentId: {
            type: ['string', 'null'],
            description:
              'Only direct children of this entry, null for top-level entries of a root'
          },
          locale: {type: 'string', description: 'Only this locale'},
          search: {type: 'string', description: 'Full text search terms'},
          status: {
            type: 'string',
            enum: statusValues,
            description:
              'Which versions to return. preferDraft (default) shows the latest version of each entry'
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 200,
            description: 'Maximum number of results, default 50'
          },
          offset: {type: 'integer', minimum: 0, description: 'Skip results'}
        },
        additionalProperties: false
      },
      annotations: {readOnlyHint: true, openWorldHint: false},
      async call(args) {
        const workspace = stringArg(args, 'workspace')
        const root = stringArg(args, 'root')
        const typeName = stringArg(args, 'type')
        const locale = stringArg(args, 'locale')
        const search = stringArg(args, 'search')
        if (workspace) workspaceOf(workspace)
        if (root) rootOf(workspace ?? keys(config.workspaces)[0], root)
        const query: GraphQuery<undefined, Type | undefined, undefined> = {
          status: (stringArg(args, 'status') as Status) ?? 'preferDraft'
        }
        if (workspace) query.workspace = workspace
        if (root) query.root = root
        if (typeName) query.type = typeOf(typeName)
        if (args.parentId !== undefined)
          query.parentId = args.parentId as string | null
        if (locale) query.locale = locale
        if (search) query.search = search
        const limit = Math.min(Number(args.limit ?? 50), 200)
        const offset = Number(args.offset ?? 0)
        const total = (await graph.count(query)) as number
        const found = (await graph.find({
          ...query,
          skip: offset,
          take: limit,
          select: summarySelection
        })) as Array<EntrySummary>
        const counts = await childrenCounts(
          found.map(entry => entry.id),
          locale
        )
        return {
          total,
          offset,
          entries: found.map(entry => ({
            ...entry,
            childrenCount: counts.get(entry.id) ?? 0
          }))
        }
      }
    },
    {
      name: 'get_entry',
      title: 'Get an entry',
      description:
        'Get one entry by id (or by url) with its metadata, file path and field data. Rich text is returned as Markdown by default, which create_entry/update_entry accept back; pass richText: "raw" for the stored JSON or "both" to get raw data plus a markdown map.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {type: 'string', description: 'Entry id'},
          url: {type: 'string', description: 'Entry url, eg "/docs/intro"'},
          locale: localeSchema,
          status: {
            type: 'string',
            enum: statusValues,
            description: 'Which version to read, default preferDraft'
          },
          richText: {
            type: 'string',
            enum: ['markdown', 'raw', 'both'],
            description: 'How to return rich text fields, default markdown'
          }
        },
        additionalProperties: false
      },
      annotations: {readOnlyHint: true, openWorldHint: false},
      async call(args) {
        const id = stringArg(args, 'id')
        const url = stringArg(args, 'url')
        const status = (stringArg(args, 'status') as Status) ?? 'preferDraft'
        let locale = stringArg(args, 'locale')
        let entryId = id
        if (!entryId) {
          if (!url) fail('Pass an id or a url')
          const match = (await graph.first({
            url,
            ...(locale ? {locale} : {}),
            status,
            select: {id: Entry.id, locale: Entry.locale}
          })) as {id: string; locale: string | null} | null
          if (!match) fail(`No entry found with url "${url}"`)
          entryId = match.id
          locale = match.locale ?? undefined
        }
        const entry = await loadEntry(entryId, locale, status)
        const type = schema[entry.type]
        const versions = (await graph.find({
          id: entry.id,
          status: 'all',
          select: {locale: Entry.locale, status: Entry.versionStatus}
        })) as Array<{locale: string | null; status: EntryStatus}>
        const counts = await childrenCounts([entry.id], entry.locale)
        const mode = stringArg(args, 'richText') ?? 'markdown'
        const {filePath: _filePath, data, ...meta} = entry
        const result: Record<string, unknown> = {
          ...meta,
          file: diskPath(entry),
          childrenCount: counts.get(entry.id) ?? 0,
          versions,
          data: type && mode === 'markdown' ? renderRichText(type, data) : data
        }
        if (type && mode === 'both') {
          const markdown: Record<string, unknown> = {}
          for (const [key, field] of entries(Type.fields(type)))
            if (fieldKind(field) === 'richText' && Array.isArray(data[key]))
              markdown[key] = renderValue(field, data[key])
          result.markdown = markdown
        }
        return result
      }
    },
    {
      name: 'create_entry',
      title: 'Create an entry',
      description:
        'Create an entry (or a translation of an existing entry with translationOf). `data` holds field values keyed by field name, see describe_schema valueFormats: rich text as Markdown, links as entry ids, list rows without _id/_index. `title` is required, `path` defaults to the slugified title. Returns the entry id, url and file.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {type: 'string', description: 'Type name, eg "Page"'},
          workspace: {
            type: 'string',
            description:
              "Workspace name, defaults to the parent's or the first workspace"
          },
          root: {
            type: 'string',
            description: "Root name, defaults to the parent's or the first root"
          },
          parentId: {
            type: 'string',
            description:
              'Id of the parent entry, leave out to create at the root level'
          },
          locale: localeSchema,
          translationOf: {
            type: 'string',
            description:
              'Id of an existing entry to translate into `locale`. Fields not in data are copied from the existing translation'
          },
          data: {
            type: 'object',
            description: 'Field values keyed by field name'
          },
          publish: {
            type: 'boolean',
            description: 'Publish the entry (default true), false saves a draft'
          },
          insertOrder: {
            type: 'string',
            enum: ['first', 'last'],
            description: 'Position among its siblings, default last'
          }
        },
        required: ['data'],
        additionalProperties: false
      },
      annotations: {destructiveHint: false, openWorldHint: false},
      async call(args) {
        const data = args.data as Record<string, unknown>
        const translationOf = stringArg(args, 'translationOf')
        let typeName = stringArg(args, 'type')
        let workspace = stringArg(args, 'workspace')
        let root = stringArg(args, 'root')
        let parentId = stringArg(args, 'parentId') ?? null
        let base: Record<string, unknown> | undefined
        if (translationOf) {
          const versions = (await graph.find({
            id: translationOf,
            status: 'preferPublished',
            select: storedSelection
          })) as Array<StoredEntry>
          const source = versions[0]
          if (!source) fail(`Entry "${translationOf}" not found`)
          if (typeName && typeName !== source.type)
            fail(
              `Entry "${translationOf}" is a ${source.type}, a translation must have the same type`
            )
          if (workspace && workspace !== source.workspace)
            fail(
              `Entry "${translationOf}" is in workspace "${source.workspace}"`
            )
          if (root && root !== source.root)
            fail(`Entry "${translationOf}" is in root "${source.root}"`)
          typeName = source.type
          workspace = source.workspace
          root = source.root
          parentId = stringArg(args, 'parentId') ?? source.parentId
          const locale = stringArg(args, 'locale')
          if (!locale) fail('Pass the locale to translate into')
          if (versions.some(version => version.locale === locale))
            fail(
              `Entry "${translationOf}" already has a "${locale}" translation, use update_entry`
            )
          base = source.data
        } else if (parentId) {
          const parent = (await graph.first({
            id: parentId,
            status: 'preferDraft',
            select: summarySelection
          })) as EntrySummary | null
          if (!parent) fail(`Parent "${parentId}" not found`)
          workspace ??= parent.workspace
          root ??= parent.root
        }
        if (!typeName) fail('Pass the type of the entry, see describe_schema')
        const type = typeOf(typeName)
        if (type === MediaFile) fail('Media files are created with upload_file')
        const [workspaceName] = workspaceOf(workspace)
        const rootName = rootOf(workspaceName, root).key
        const locale = localeFor(
          workspaceName,
          rootName,
          stringArg(args, 'locale')
        )
        const {allowed, where} = await allowedChildTypes(
          workspaceName,
          rootName,
          parentId,
          locale
        )
        if (!allowed.includes(typeName))
          fail(
            allowed.length
              ? `Type "${typeName}" is not allowed in ${where}, allowed types: ${allowed.join(', ')}`
              : `No entries can be created in ${where}, it contains no types`
          )
        const input = new EntryInput()
        const converted = input.typeData(type, data, '')
        await checkReferences(input)
        const merged = {...(base ?? Type.initialValue(type)), ...converted}
        const title = merged.title
        if (typeof title !== 'string' || !title.trim())
          fail('data.title: a title is required')
        if (!converted.path && (!base || converted.title))
          merged.path = slugify(title)
        const status = statusFor(args.publish !== false, type)
        const prepared = Type.beforeSave(
          type,
          Type.withInitialValue(type, merged),
          {
            action: translationOf ? 'translate' : 'create',
            user: options.user,
            now: new Date()
          }
        )
        const parentType = parentId
          ? await graph.first({
              id: parentId,
              select: Entry.type,
              status: 'preferDraft'
            })
          : null
        const parentInsertOrder =
          typeof parentType === 'string' && schema[parentType]
            ? Type.insertOrder(schema[parentType])
            : 'free'
        const insertOrder =
          parentInsertOrder !== 'free'
            ? parentInsertOrder
            : (stringArg(args, 'insertOrder') as 'first' | 'last' | undefined)
        const created = (await graph.create({
          type,
          ...(translationOf ? {id: translationOf} : {}),
          workspace: workspaceName,
          root: rootName,
          parentId,
          locale,
          status,
          insertOrder,
          set: prepared,
          select: {...summarySelection, filePath: Entry.filePath}
        })) as EntrySummary & {filePath: string}
        return summary(created)
      }
    },
    {
      name: 'update_entry',
      title: 'Update an entry',
      description:
        'Change fields of an existing entry. Only fields present in `data` change (object and localised fields merge key by key, lists and rich text are replaced). Same value formats as create_entry. Published by default, publish: false saves a draft instead.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {type: 'string', description: 'Entry id'},
          locale: localeSchema,
          data: {
            type: 'object',
            description: 'Field values to change, keyed by field name'
          },
          publish: {
            type: 'boolean',
            description:
              'Publish the changes (default true), false saves a draft'
          }
        },
        required: ['id', 'data'],
        additionalProperties: false
      },
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      async call(args) {
        const id = stringArg(args, 'id')!
        const current = await loadEntry(id, stringArg(args, 'locale'))
        const type = typeOf(current.type)
        if (type === MediaFile) {
          const allowed = new Set(['title', 'alt', 'focus'])
          for (const key of keys(args.data as object))
            if (!allowed.has(key))
              fail(
                `Media files only accept changes to: ${[...allowed].join(', ')}`
              )
        }
        const input = new EntryInput()
        const converted = input.typeData(type, args.data, '')
        await checkReferences(input)
        const publish = args.publish !== false
        const status = statusFor(publish, type)
        const merged = mergeTypeData(type, current.data, converted)
        const prepared = Type.beforeSave(
          type,
          Type.withInitialValue(type, merged),
          {
            action: publish ? 'publish' : 'update',
            user: options.user,
            now: new Date()
          }
        )
        const saved = (await graph.create({
          type,
          id,
          locale: current.locale,
          status,
          set: prepared,
          overwrite: true,
          select: {...summarySelection, filePath: Entry.filePath}
        })) as EntrySummary & {filePath: string}
        return {...summary(saved), changed: keys(converted)}
      }
    },
    {
      name: 'delete_entry',
      title: 'Delete an entry',
      description:
        'Delete an entry with its children (in all locales by default). Pass locale to delete one translation, or status "draft" to discard only the draft. Media files are removed from disk as well.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {type: 'string', description: 'Entry id'},
          locale: {type: 'string', description: 'Only delete this translation'},
          status: {
            type: 'string',
            enum: ['draft', 'published', 'archived'],
            description: 'Only delete this version'
          }
        },
        required: ['id'],
        additionalProperties: false
      },
      annotations: {destructiveHint: true, openWorldHint: false},
      async call(args) {
        const id = stringArg(args, 'id')!
        const locale = stringArg(args, 'locale')
        const status = stringArg(args, 'status') as EntryStatus | undefined
        const versions = (await graph.find({
          id,
          status: 'all',
          select: {...summarySelection, versionStatus: Entry.versionStatus}
        })) as Array<EntrySummary & {versionStatus: EntryStatus}>
        const matching = versions.filter(
          version =>
            (!locale || version.locale === locale) &&
            (!status || version.versionStatus === status)
        )
        if (matching.length === 0)
          fail(
            versions.length
              ? `Entry "${id}" has no matching version, it has: ${versions.map(v => `${v.locale ?? ''} ${v.versionStatus}`.trim()).join(', ')}`
              : `Entry "${id}" not found`
          )
        const references = await graph.referencesTo({
          targetId: id,
          status: 'all'
        })
        await graph.mutate([
          {
            op: 'remove',
            id,
            ...(locale ? {locale} : {}),
            ...(status ? {status} : {})
          }
        ])
        return {
          deleted: matching.map(version => ({
            id,
            title: version.title,
            locale: version.locale,
            status: version.versionStatus
          })),
          ...(references.total
            ? {
                warning: `${references.total} reference(s) from other entries now point to a missing entry: ${[
                  ...new Set(references.references.map(ref => ref.sourceId))
                ].join(', ')}`
              }
            : {})
        }
      }
    },
    {
      name: 'publish_entry',
      title: 'Publish an entry',
      description:
        'Publish the draft of an entry, or restore an archived entry. Does nothing to already published entries.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {type: 'string', description: 'Entry id'},
          locale: localeSchema
        },
        required: ['id'],
        additionalProperties: false
      },
      annotations: {destructiveHint: false, openWorldHint: false},
      async call(args) {
        const id = stringArg(args, 'id')!
        const entry = await loadEntry(
          id,
          stringArg(args, 'locale'),
          'all'
        ).catch(() => undefined)
        const versions = (await graph.find({
          id,
          status: 'all',
          select: {locale: Entry.locale, status: Entry.versionStatus}
        })) as Array<{locale: string | null; status: EntryStatus}>
        if (versions.length === 0) fail(`Entry "${id}" not found`)
        const locale =
          stringArg(args, 'locale') ?? entry?.locale ?? versions[0].locale
        const forLocale = versions.filter(version => version.locale === locale)
        const from = forLocale.some(version => version.status === 'draft')
          ? 'draft'
          : forLocale.some(version => version.status === 'archived')
            ? 'archived'
            : undefined
        if (!from)
          return {id, locale, status: 'published', note: 'Already published'}
        await graph.publish({id, locale, status: from})
        return {id, locale, status: 'published', from}
      }
    },
    {
      name: 'archive_entry',
      title: 'Archive an entry',
      description:
        'Archive a published entry: it is hidden from the site but kept, publish_entry restores it.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {type: 'string', description: 'Entry id'},
          locale: localeSchema
        },
        required: ['id'],
        additionalProperties: false
      },
      annotations: {destructiveHint: false, openWorldHint: false},
      async call(args) {
        const id = stringArg(args, 'id')!
        const entry = await loadEntry(
          id,
          stringArg(args, 'locale'),
          'published'
        )
        await graph.archive({id, locale: entry.locale})
        return {id, locale: entry.locale, status: 'archived'}
      }
    },
    {
      name: 'move_entry',
      title: 'Move an entry',
      description:
        'Move an entry (with its children and translations): directly after or before a sibling, or into a new parent as its last child. Pass parentId null to move it to the top level of its root.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {type: 'string', description: 'Entry id'},
          parentId: {
            type: ['string', 'null'],
            description: 'New parent id, null for the top level of the root'
          },
          after: {type: 'string', description: 'Place right after this entry'},
          before: {
            type: 'string',
            description: 'Place right before this entry'
          },
          root: {
            type: 'string',
            description:
              'With parentId null: the root to move to, defaults to the current root'
          }
        },
        required: ['id'],
        additionalProperties: false
      },
      annotations: {destructiveHint: false, openWorldHint: false},
      async call(args) {
        const id = stringArg(args, 'id')!
        const after = stringArg(args, 'after')
        const before = stringArg(args, 'before')
        const targets = [after, before, args.parentId !== undefined].filter(
          Boolean
        )
        if (targets.length !== 1)
          fail('Pass exactly one of parentId, after or before')
        const entry = (await graph.first({
          id,
          status: 'preferDraft',
          select: summarySelection
        })) as EntrySummary | null
        if (!entry) fail(`Entry "${id}" not found`)
        const sibling = after ?? before
        let newParent: string | null
        let rootName = entry.root
        if (sibling) {
          const target = (await graph.first({
            id: sibling,
            status: 'preferDraft',
            select: summarySelection
          })) as EntrySummary | null
          if (!target) fail(`Entry "${sibling}" not found`)
          newParent = target.parentId
          rootName = target.root
          if (target.workspace !== entry.workspace)
            fail('Entries can only move within their workspace')
        } else {
          newParent = (args.parentId as string | null) ?? null
          if (newParent) {
            const parent = (await graph.first({
              id: newParent,
              status: 'preferDraft',
              select: summarySelection
            })) as EntrySummary | null
            if (!parent) fail(`Parent "${newParent}" not found`)
            if (parent.workspace !== entry.workspace)
              fail('Entries can only move within their workspace')
            rootName = parent.root
          } else {
            rootName = stringArg(args, 'root') ?? entry.root
            rootOf(entry.workspace, rootName)
          }
        }
        if (newParent !== entry.parentId || rootName !== entry.root) {
          const {allowed, where} = await allowedChildTypes(
            entry.workspace,
            rootName,
            newParent,
            null
          ).catch(() =>
            allowedChildTypes(
              entry.workspace,
              rootName,
              newParent,
              entry.locale
            )
          )
          if (!allowed.includes(entry.type))
            fail(
              `Type "${entry.type}" is not allowed in ${where}, allowed types: ${allowed.join(', ')}`
            )
        }
        await graph.move(
          sibling
            ? {id, target: sibling, dropPosition: after ? 'after' : 'before'}
            : newParent
              ? {id, target: newParent, dropPosition: 'on'}
              : {id, target: rootName, dropPosition: 'on', targetType: 'root'}
        )
        const moved = (await graph.first({
          id,
          status: 'preferDraft',
          select: {...summarySelection, filePath: Entry.filePath}
        })) as EntrySummary & {filePath: string}
        return summary(moved)
      }
    },
    {
      name: 'upload_file',
      title: 'Upload a file',
      description:
        'Add an image or other file to a workspace media library, from a local path inside the project or an http(s) url. Image dimensions, average color, thumbhash and preview are computed. Returns the media entry id to use in image and file fields (or ![alt](entry:ID) in rich text).',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Local file path, relative to the project directory'
          },
          url: {type: 'string', description: 'http(s) url to download'},
          workspace: {type: 'string', description: 'Workspace name'},
          parentId: {
            type: 'string',
            description:
              'Id of a media folder (MediaLibrary entry) to upload into'
          },
          title: {
            type: 'string',
            description: 'Title of the media entry, defaults to the file name'
          }
        },
        additionalProperties: false
      },
      annotations: {destructiveHint: false, openWorldHint: true},
      async call(args) {
        const localPath = stringArg(args, 'path')
        const url = stringArg(args, 'url')
        if (Boolean(localPath) === Boolean(url)) fail('Pass either path or url')
        const [workspace, workspaceConfig] = workspaceOf(
          stringArg(args, 'workspace')
        )
        let mediaRoot: string
        try {
          mediaRoot = Workspace.defaultMediaRoot(workspaceConfig)
        } catch {
          fail(`Workspace "${workspace}" has no media root`)
        }
        const parentId = stringArg(args, 'parentId') ?? null
        if (parentId) {
          const parent = (await graph.first({
            id: parentId,
            status: 'preferDraft',
            select: summarySelection
          })) as EntrySummary | null
          if (!parent || parent.type !== typeNames.get(MediaLibrary))
            fail(`Parent "${parentId}" is not a media folder (MediaLibrary)`)
          if (parent.workspace !== workspace)
            fail(
              `Media folder "${parentId}" is in workspace "${parent.workspace}"`
            )
          mediaRoot = parent.root
        }
        let bytes: Uint8Array
        let fileName: string
        let contentType = 'application/octet-stream'
        if (localPath) {
          const location = path.resolve(rootDir, localPath)
          const relative = path.relative(rootDir, location)
          if (relative.startsWith('..') || path.isAbsolute(relative))
            fail(`"${localPath}" is outside the project directory`)
          try {
            bytes = new Uint8Array(await fs.readFile(location))
          } catch {
            fail(`Could not read "${localPath}"`)
          }
          fileName = path.basename(location)
        } else {
          let parsed: URL
          try {
            parsed = new URL(url!)
          } catch {
            fail(`Invalid url "${url}"`)
          }
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            fail('Only http and https urls can be downloaded')
          const response = await (options.fetch ?? globalThis.fetch)(parsed)
          if (!response.ok)
            fail(
              `Downloading ${url} failed: ${response.status} ${response.statusText}`
            )
          bytes = new Uint8Array(await response.arrayBuffer())
          contentType = response.headers.get('content-type') ?? contentType
          fileName =
            decodeURIComponent(parsed.pathname.split('/').pop() ?? '') ||
            'download'
          if (!path.extname(fileName)) {
            const extension = contentType.split(';')[0].split('/')[1]
            if (extension)
              fileName += `.${extension.replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`
          }
        }
        const extension = path.extname(fileName)
        const title = stringArg(args, 'title')
        if (title) fileName = `${title}${extension}`
        const file = new File([bytes as BlobPart], fileName, {
          type: contentType
        })
        let preview: ImagePreviewDetails | undefined
        let warning: string | undefined
        if (isImage(fileName) && options.createPreview) {
          try {
            preview = await options.createPreview(file)
          } catch (error) {
            warning = `No image preview: ${error instanceof Error ? error.message : String(error)}`
          }
        }
        const uploaded = (await graph.upload({
          file,
          workspace,
          root: mediaRoot,
          parentId,
          ...(preview ? {createPreview: async () => preview!} : {})
        })) as Record<string, unknown>
        const media = (await graph.first({
          id: uploaded._id as string,
          status: 'preferDraft',
          select: {
            ...summarySelection,
            filePath: Entry.filePath,
            data: Entry.data
          }
        })) as
          | (EntrySummary & {filePath: string; data: Record<string, unknown>})
          | null
        if (!media) fail('Upload finished but the media entry was not found')
        const {data} = media
        return {
          id: media.id,
          title: media.title,
          url: media.url,
          file: diskPath(media),
          location: data.location,
          extension: data.extension,
          size: data.size,
          ...(data.width ? {width: data.width, height: data.height} : {}),
          ...(warning ? {warning} : {})
        }
      }
    }
  ]
  return tools
}
