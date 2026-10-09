import {existsSync} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import {Config} from '#/core/Config.js'
import {UploadOperation, type UploadQuery} from '#/core/db/Operation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Entry} from '#/core/Entry.js'
import type {Status} from '#/core/Graph.js'
import type {ImagePreviewDetails} from '#/core/media/CreatePreview.js'
import {isImageCrop, isImageRotation} from '#/core/media/ImageTransform.js'
import {Root} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import type {User} from '#/core/User.js'
import {formatFieldPath, validateEntry} from '#/core/Validation.js'
import {entries, keys} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import {Workspace} from '#/core/Workspace.js'
import {inputData, outputData} from './McpInput.js'
import type {JsonSchema, McpTool} from './McpServer.js'
import {describeSchema} from './McpSchema.js'

export interface ContentToolsOptions {
  config: Config
  /** Reads and writes content, writes must take the dashboard's path */
  graph: WriteableGraph
  /** The project directory, relative upload paths resolve against it */
  rootDir: string
  /** Directories files may be uploaded from, defaults to the git repository */
  uploadRoots?: Array<string>
  /** The user recorded in metadata fields */
  user?: User
  createPreview?(blob: Blob): Promise<ImagePreviewDetails | undefined>
  /** Rotates, crops and scales down images before uploading */
  transformImage?: UploadQuery['transformImage']
  /** Recompresses the images of pdfs before uploading */
  compressPdf?: UploadQuery['compressPdf']
}

/** The git repository root enclosing a directory, if any */
export function gitRoot(dir: string): string | undefined {
  for (let current = path.resolve(dir); ; current = path.dirname(current)) {
    if (existsSync(path.join(current, '.git'))) return current
    if (path.dirname(current) === current) return undefined
  }
}

interface Summary {
  id: string
  type: string
  title: string
  url: string
  parentId: string | null
  locale: string | null
  status: string
  workspace: string
  root: string
  filePath: string
}

const summary = {
  id: Entry.id,
  type: Entry.type,
  title: Entry.title,
  url: Entry.url,
  parentId: Entry.parentId,
  locale: Entry.locale,
  status: Entry.status,
  workspace: Entry.workspace,
  root: Entry.root,
  filePath: Entry.filePath
}

function string(description: string, extra?: JsonSchema): JsonSchema {
  return {type: 'string', description, ...extra}
}

function input(
  properties: Record<string, JsonSchema>,
  required: Array<string> = []
): JsonSchema {
  return {type: 'object', properties, required, additionalProperties: false}
}

const id = string('Entry id')
const locale = string("Locale, defaults to the root's first locale")
const publish: JsonSchema = {
  type: 'boolean',
  description: 'Publish (default), false saves a draft'
}

function fail(message: string): never {
  throw new Error(message)
}

export function createContentTools(
  options: ContentToolsOptions
): Array<McpTool> {
  const {config, graph, user} = options
  const {schema} = config
  const rootDir = path.resolve(options.rootDir)
  const repository = gitRoot(rootDir)
  const uploadRoots = [
    rootDir,
    ...(options.uploadRoots ?? (repository ? [repository] : []))
  ]

  function str(args: Record<string, unknown>, key: string) {
    const value = args[key]
    return typeof value === 'string' && value ? value : undefined
  }

  function typeOf(name: string): Type {
    return (
      schema[name] ??
      fail(`Type "${name}" not found, available: ${keys(schema).join(', ')}`)
    )
  }

  function output({filePath, ...entry}: Summary) {
    return {
      ...entry,
      file: path.posix.join(Config.contentDir(config), filePath)
    }
  }

  function status(publish: unknown): 'published' | 'draft' {
    if (publish !== false) return 'published'
    if (!config.enableDrafts) fail('Drafts are not enabled, leave out publish')
    return 'draft'
  }

  /**
   * Editors may publish invalid fields anyway, agents fix them first: the
   * error lists each field and what is wrong with it.
   */
  function checkPublishable(type: Type, data: Record<string, unknown>) {
    const errors = validateEntry(type, data)
    if (errors.length === 0) return
    const draft = config.enableDrafts
      ? ', or pass publish: false to save a draft'
      : ''
    const fields = errors.map(
      error => `- data.${formatFieldPath(error.path)}: ${error.message}`
    )
    fail(
      `Cannot publish, fix these fields first${draft}:\n${fields.join('\n')}`
    )
  }

  /** The version in a locale, the root's default locale if none is given */
  function inLocale<
    Version extends Pick<Summary, 'locale' | 'workspace' | 'root'>
  >(versions: Array<Version>, locale: string | undefined): Version {
    const [first] = versions
    if (!first) fail('Entry not found, use find_entries to look up ids')
    const root = Workspace.roots(config.workspaces[first.workspace])[first.root]
    const wanted = locale ?? Root.defaultLocale(root) ?? null
    return (
      versions.find(version => version.locale === wanted) ??
      (locale
        ? fail(
            `No "${locale}" version, available: ${versions.map(v => v.locale).join(', ')}`
          )
        : first)
    )
  }

  async function loadEntry(
    id: string,
    locale?: string,
    status: Status = 'preferDraft'
  ) {
    const versions = await graph.find({
      id,
      status,
      select: {...summary, data: Entry.data}
    })
    return inLocale(
      versions as Array<Summary & {data: Record<string, unknown>}>,
      locale
    )
  }

  /** Links must point to existing entries, image and file links to media */
  async function checkLinks(type: Type, data: Record<string, unknown>) {
    const links = Type.references(type, data)
    if (!links.length) return
    const found = (await graph.find({
      id: {in: links.map(link => link.targetId)},
      status: 'preferDraft',
      select: {id: Entry.id, type: Entry.type}
    })) as Array<{id: string; type: string}>
    const types = new Map(found.map(entry => [entry.id, entry.type]))
    for (const {targetId, fieldPath, linkType} of links) {
      const type = types.get(targetId)
      if (!type) fail(`data.${fieldPath}: entry "${targetId}" does not exist`)
      if (linkType && linkType !== 'entry' && type !== 'MediaFile')
        fail(
          `data.${fieldPath}: "${targetId}" is a ${type}, upload_file returns media ids`
        )
    }
  }

  async function referencedBy(id: string) {
    const {references} = await graph.referencesTo({
      targetId: id,
      status: 'preferDraft'
    })
    const sources = (await graph.find({
      id: {in: references.map(reference => reference.sourceId)},
      status: 'preferDraft',
      select: {id: Entry.id, title: Entry.title}
    })) as Array<{id: string; title: string}>
    const titles = new Map(sources.map(source => [source.id, source.title]))
    return references.map(reference => ({
      id: reference.sourceId,
      title: titles.get(reference.sourceId),
      type: reference.sourceType,
      locale: reference.sourceLocale,
      field: reference.fieldPath
    }))
  }

  return [
    {
      name: 'describe_schema',
      description:
        'Workspaces and roots (locales, allowed types), entry types with their fields, block types in definitions, and the value format of each field kind.',
      inputSchema: input({type: string('Only describe this type')}),
      annotations: {readOnlyHint: true},
      async call(args) {
        return describeSchema(config, str(args, 'type'))
      }
    },
    {
      name: 'find_entries',
      description:
        'List entries by location, type or search terms, with the total count. Siblings are in their order when filtering by parentId.',
      inputSchema: input({
        workspace: string('Workspace name'),
        root: string('Root name'),
        parentId: {
          type: ['string', 'null'],
          description:
            'Direct children of this entry, null for top-level entries'
        },
        type: string('Type name'),
        locale: string('Locale'),
        search: string('Full text search terms'),
        status: string('Versions to list, default the latest of each', {
          enum: [
            'preferDraft',
            'preferPublished',
            'published',
            'draft',
            'archived',
            'all'
          ]
        }),
        limit: {type: 'integer', description: 'Default 50'},
        offset: {type: 'integer'}
      }),
      annotations: {readOnlyHint: true},
      async call(args) {
        const query = Object.fromEntries(
          entries({
            workspace: str(args, 'workspace'),
            root: str(args, 'root'),
            parentId: args.parentId,
            type: str(args, 'type') && typeOf(str(args, 'type')!),
            locale: str(args, 'locale'),
            search: str(args, 'search'),
            status: str(args, 'status') ?? 'preferDraft'
          }).filter(([, value]) => value !== undefined)
        )
        const found = await graph.find({
          ...query,
          skip: Number(args.offset ?? 0),
          take: Number(args.limit ?? 50),
          orderBy: query.search
            ? undefined
            : 'parentId' in query
              ? {asc: Entry.index}
              : {asc: Entry.url},
          select: {
            ...summary,
            children: {edge: 'children', count: true}
          }
        })
        return {
          total: await graph.count(query),
          entries: (found as Array<Summary & {children: number}>).map(output)
        }
      }
    },
    {
      name: 'get_entry',
      description:
        'One entry by id or url: its metadata, versions, the entries linking to it and its field data, rich text as Markdown.',
      inputSchema: input({
        id,
        url: string('Entry url, eg. "/blog/hello"'),
        locale
      }),
      annotations: {readOnlyHint: true},
      async call(args) {
        const url = str(args, 'url')
        const entryId =
          str(args, 'id') ??
          (url &&
            ((await graph.first({
              url,
              status: 'preferDraft',
              select: Entry.id
            })) as string)) ??
          fail(url ? `No entry at "${url}"` : 'Pass an id or url')
        const {data, ...entry} = await loadEntry(entryId, str(args, 'locale'))
        return {
          ...output(entry),
          versions: await graph.find({
            id: entryId,
            status: 'all',
            select: {locale: Entry.locale, status: Entry.versionStatus}
          }),
          referencedBy: await referencedBy(entryId),
          data: outputData(typeOf(entry.type), data)
        }
      }
    },
    {
      name: 'create_entry',
      description:
        'Create an entry, or the translation of an entry with translationOf. data holds field values (title is required, path defaults to the slugified title).',
      inputSchema: input(
        {
          type: string('Type name'),
          parentId: string('Parent entry, leave out for the top level'),
          workspace: string("Defaults to the parent's or the first"),
          root: string("Defaults to the parent's or the first"),
          locale,
          translationOf: string(
            'Entry to translate into locale, fields not in data are copied'
          ),
          data: {type: 'object', description: 'Field values by field name'},
          publish
        },
        ['data']
      ),
      async call(args) {
        const translationOf = str(args, 'translationOf')
        const source = translationOf
          ? await loadEntry(translationOf, undefined, 'preferPublished')
          : undefined
        const typeName =
          str(args, 'type') ?? source?.type ?? fail('Pass the type')
        const type = typeOf(typeName)
        if (typeName === 'MediaFile') fail('Upload media with upload_file')
        const parentId = str(args, 'parentId') ?? source?.parentId ?? null
        const parent = parentId
          ? (((await graph.first({
              id: parentId,
              status: 'preferDraft',
              select: summary
            })) as Summary | null) ?? fail(`Parent "${parentId}" not found`))
          : undefined
        const workspace =
          str(args, 'workspace') ??
          source?.workspace ??
          parent?.workspace ??
          keys(config.workspaces)[0]
        const workspaceConfig =
          config.workspaces[workspace] ??
          fail(`Workspace "${workspace}" not found`)
        const root =
          str(args, 'root') ??
          source?.root ??
          parent?.root ??
          Workspace.defaultRoot(workspaceConfig)
        const rootConfig =
          Workspace.roots(workspaceConfig)[root] ??
          fail(`Root "${root}" not found`)
        const locale = translationOf
          ? (str(args, 'locale') ?? fail('Pass the locale to translate into'))
          : (str(args, 'locale') ?? Root.defaultLocale(rootConfig) ?? null)
        const allowed = Schema.contained(
          schema,
          parent
            ? Type.contains(typeOf(parent.type))
            : Root.isMediaRoot(rootConfig)
              ? ['MediaLibrary']
              : Root.contains(rootConfig)
        )
        if (!allowed.includes(typeName))
          fail(
            `Type "${typeName}" is not allowed in ${parent ? `"${parent.title}"` : `root "${root}"`}, allowed: ${allowed.join(', ') || 'none'}`
          )
        const converted = inputData(type, args.data)
        await checkLinks(type, converted)
        const data = Type.withInitialValue(type, {
          ...Type.initialValue(type),
          ...source?.data,
          ...converted
        })
        if (!data.title) fail('data.title is required')
        // The transaction derives the path from the title
        if (!converted.path) delete data.path
        const saveAs = status(args.publish)
        if (saveAs === 'published')
          checkPublishable(type, {
            ...data,
            path: data.path || slugify(String(data.title))
          })
        const insertOrder = parent && Type.insertOrder(typeOf(parent.type))
        const created = await graph.create({
          type,
          id: translationOf,
          workspace,
          root,
          parentId,
          locale,
          status: saveAs,
          insertOrder: insertOrder === 'free' ? undefined : insertOrder,
          set: data,
          user,
          select: summary
        })
        return output(created as Summary)
      }
    },
    {
      name: 'update_entry',
      description:
        'Change fields of an entry, others keep their value. Object and localised fields merge, lists are replaced (rows with a current _id update that row).',
      inputSchema: input(
        {
          id,
          locale,
          data: {type: 'object', description: 'Field values to change'},
          publish
        },
        ['id', 'data']
      ),
      async call(args) {
        const current = await loadEntry(
          str(args, 'id') ?? fail('Pass an id'),
          str(args, 'locale')
        )
        const type = typeOf(current.type)
        const converted = inputData(type, args.data, current.data)
        await checkLinks(type, converted)
        const saveAs = status(args.publish)
        const {id, locale} = current
        if (
          current.status === saveAs &&
          JSON.stringify({...current.data, ...converted}) ===
            JSON.stringify(current.data)
        )
          return {...output(current), note: 'No changes'}
        // Like the dashboard's editor: every field, in field order
        const data = Type.withInitialValue(type, {
          ...Type.initialValue(type),
          ...current.data,
          ...converted
        })
        if (saveAs === 'published') checkPublishable(type, data)
        // The dashboard's save: the whole entry, as a draft or published
        await graph.mutate([
          {
            op: 'create',
            id,
            locale,
            parentId: current.parentId,
            workspace: current.workspace,
            root: current.root,
            type: current.type,
            status: saveAs,
            overwrite: true,
            data: Type.beforeSave(type, data, {
              action: saveAs === 'published' ? 'publish' : 'update',
              user,
              now: new Date()
            })
          }
        ])
        const saved = await graph.get({
          id,
          locale,
          status: saveAs === 'draft' ? 'preferDraft' : 'preferPublished',
          select: summary
        })
        return output(saved as Summary)
      }
    },
    {
      name: 'publish_entry',
      description:
        'Publish the draft of an entry, restore it when archived, or archive it with archive: true.',
      inputSchema: input(
        {
          id,
          locale,
          archive: {type: 'boolean', description: 'Archive instead'}
        },
        ['id']
      ),
      async call(args) {
        const id = str(args, 'id') ?? fail('Pass an id')
        const versions = (await graph.find({
          id,
          status: 'all',
          select: {
            locale: Entry.locale,
            status: Entry.versionStatus,
            workspace: Entry.workspace,
            root: Entry.root
          }
        })) as Array<Pick<Summary, 'locale' | 'status' | 'workspace' | 'root'>>
        const {locale} = inLocale(versions, str(args, 'locale'))
        if (args.archive === true) {
          await graph.archive({id, locale})
          return {id, locale, status: 'archived'}
        }
        const from = (['draft', 'archived'] as const).find(status =>
          versions.some(
            version => version.locale === locale && version.status === status
          )
        )
        if (!from)
          return {id, locale, status: 'published', note: 'Already published'}
        const pending = (await graph.first({
          id,
          locale,
          status: from,
          select: {type: Entry.type, data: Entry.data}
        })) as {type: string; data: Record<string, unknown>} | null
        if (pending) checkPublishable(typeOf(pending.type), pending.data)
        await graph.publish({id, locale, status: from})
        return {id, locale, status: 'published'}
      }
    },
    {
      name: 'delete_entry',
      description:
        'Delete an entry with its children and translations, or one locale or version. Refuses when other entries link to it, unless force is true.',
      inputSchema: input(
        {
          id,
          locale: string('Only this translation'),
          status: string('Only this version', {
            enum: ['draft', 'published', 'archived']
          }),
          force: {type: 'boolean', description: 'Delete even when linked to'}
        },
        ['id']
      ),
      annotations: {destructiveHint: true},
      async call(args) {
        const id = str(args, 'id') ?? fail('Pass an id')
        const locale = str(args, 'locale')
        const version = str(args, 'status') as 'draft' | undefined
        if (!locale && !version && args.force !== true) {
          const links = (await referencedBy(id)).filter(link => link.id !== id)
          if (links.length)
            fail(
              `Entry "${id}" is linked from:\n${links
                .map(link => `- ${link.title} (${link.id}) field ${link.field}`)
                .join('\n')}\nChange those links or pass force: true`
            )
        }
        await graph.mutate([{op: 'remove', id, locale, status: version}])
        return {deleted: id}
      }
    },
    {
      name: 'move_entry',
      description:
        'Move an entry with its children: after or before a sibling, or into a parent as its last child (parentId null for the top level of root).',
      inputSchema: input(
        {
          id,
          after: string('Sibling to place it after'),
          before: string('Sibling to place it before'),
          parentId: {type: ['string', 'null'], description: 'New parent'},
          root: string('With parentId null: the root, defaults to the current')
        },
        ['id']
      ),
      async call(args) {
        const id = str(args, 'id') ?? fail('Pass an id')
        const after = str(args, 'after')
        const before = str(args, 'before')
        const parentId = args.parentId as string | null | undefined
        if ([after, before, parentId].filter(v => v !== undefined).length !== 1)
          fail('Pass one of after, before or parentId')
        const sibling = after ?? before
        await graph.move(
          sibling
            ? {id, target: sibling, dropPosition: after ? 'after' : 'before'}
            : parentId
              ? {id, target: parentId, dropPosition: 'on'}
              : {
                  id,
                  target:
                    str(args, 'root') ??
                    ((await graph.first({
                      id,
                      status: 'all',
                      select: Entry.root
                    })) as string),
                  dropPosition: 'on',
                  targetType: 'root'
                }
        )
        const moved = await graph.first({
          id,
          status: 'preferDraft',
          select: summary
        })
        return output(moved as Summary)
      }
    },
    {
      name: 'upload_file',
      description:
        'Add a local file to the media library, images get their dimensions and preview. Returns the media id for image and file fields. replace swaps the file of a media entry, keeping its id.',
      inputSchema: input(
        {
          path: string(
            `File path, relative to ${rootDir} or absolute within the git repository`
          ),
          workspace: string('Defaults to the first workspace'),
          parentId: string('Media folder (MediaLibrary) to upload into'),
          replace: string('Media entry whose file to replace'),
          title: string('Defaults to the file name'),
          alt: {
            type: ['string', 'object'],
            description: 'Alt text, or alt texts by locale'
          },
          rotate: {
            description: 'Rotate a jpeg, png or webp image clockwise',
            enum: [0, 90, 180, 270]
          },
          crop: {
            type: 'object',
            description:
              'Crop a jpeg, png or webp image after rotating: the region to keep, as fractions (0 to 1) of its width and height',
            properties: {
              x: {type: 'number'},
              y: {type: 'number'},
              width: {type: 'number'},
              height: {type: 'number'}
            },
            required: ['x', 'y', 'width', 'height']
          }
        },
        ['path']
      ),
      async call(args) {
        const file = str(args, 'path') ?? fail('Pass a path')
        const location = path.resolve(rootDir, file)
        // Follow symlinks, and refuse hidden files such as .env or .git/*
        const real = await fs.realpath(location).catch(() => location)
        const roots = await Promise.all(
          uploadRoots.map(dir => fs.realpath(dir))
        )
        const allowed = roots.some(dir => {
          const relative = path.relative(dir, real)
          return (
            !path.isAbsolute(relative) &&
            relative.split(path.sep).every(part => !part.startsWith('.'))
          )
        })
        if (!allowed)
          fail(
            `"${file}" resolves to ${location}, which is hidden or outside ${uploadRoots.join(', ')}`
          )
        const {rotate = 0, crop} = args
        if (!isImageRotation(rotate)) fail('rotate: expected 0, 90, 180 or 270')
        if (crop !== undefined && !isImageCrop(crop))
          fail('crop: expected {x, y, width, height} between 0 and 1')
        const bytes = new Uint8Array(await fs.readFile(real))
        const replace = str(args, 'replace')
        const parentId = str(args, 'parentId') ?? null
        const target = replace ?? parentId
        const existing = target
          ? ((await graph.first({
              id: target,
              status: 'preferDraft',
              select: summary
            })) as Summary | null)
          : undefined
        const expected = replace ? 'MediaFile' : 'MediaLibrary'
        if (target && existing?.type !== expected)
          fail(`"${target}" is not a ${expected} entry`)
        const workspace =
          existing?.workspace ??
          str(args, 'workspace') ??
          keys(config.workspaces)[0]
        const extension = path.extname(location)
        const title =
          str(args, 'title') ??
          ((replace && existing?.title) || path.basename(location, extension))
        const operation = new UploadOperation({
          file: new File([bytes], title + extension),
          workspace,
          root:
            existing?.root ??
            Workspace.defaultMediaRoot(
              config.workspaces[workspace] ??
                fail(`Workspace "${workspace}" not found`)
            ),
          parentId: replace ? existing!.parentId : parentId,
          replaceId: replace,
          user,
          createPreview: options.createPreview,
          edit: {rotate, crop},
          transformImage: options.transformImage,
          compressPdf: options.compressPdf
        })
        // The dashboard's upload: store the file and create the media entry
        const mutations = await operation.task(graph)
        await graph.mutate(
          mutations.map(mutation =>
            mutation.op === 'create' && args.alt !== undefined
              ? {...mutation, data: {...mutation.data, alt: args.alt}}
              : mutation
          )
        )
        const {data, ...media} = (await graph.get({
          id: operation.id,
          status: 'preferDraft',
          select: {...summary, data: Entry.data}
        })) as Summary & {data: {location: string}}
        return {...output(media), location: data.location}
      }
    }
  ]
}
