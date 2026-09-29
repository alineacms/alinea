import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {cache} from 'react'
import {findComponent} from './componentCatalog'

/**
 * Reads the props of the alinea/components exports from their published
 * declaration files, so the tables on the component pages follow the
 * hand-written props interfaces.
 */

export interface PropDoc {
  name: string
  type: string
  required: boolean
  defaultValue?: string
  description?: string
}

export interface PartDoc {
  name: string
  description?: string
  props: Array<PropDoc>
  /** Notes on props that are passed through, eg. to a div element */
  accepts: Array<string>
}

interface InterfaceDecl {
  name: string
  extendsList: Array<string>
  members: Array<PropDoc>
}

interface DeclarationIndex {
  interfaces: Map<string, InterfaceDecl>
  /** Props declared as a union of interfaces, eg. single or multiple */
  unions: Map<string, Array<string>>
  functions: Map<string, {description?: string; module: string}>
  defaults: Map<string, Map<string, string>>
}

// Passed through props, summarized below the table instead of listed
const passThrough: Record<string, string> = {
  StyleProps: '`className` and `style`',
  AriaProps: '`id` and `aria-*` labelling attributes',
  DataProps: '`data-*` attributes'
}

function componentsDir() {
  // Resolve at runtime, alinea may be hoisted to the workspace root
  const require = createRequire(path.join(process.cwd(), 'package.json'))
  const alineaDir = path.dirname(require.resolve('alinea/package.json'))
  return path.join(alineaDir, 'dist/components')
}

function cleanComment(comment: string) {
  return comment
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

function cleanType(type: string) {
  return type
    .replace(/import\("[^"]+"\)\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/;\s*}/g, ' }')
    .trim()
}

/** Splits at a separator outside of brackets, generics and strings */
function splitTopLevel(input: string, separator: string) {
  const parts: Array<string> = []
  let depth = 0
  let quote: string | null = null
  let current = ''
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quote) {
      if (char === quote && input[i - 1] !== '\\') quote = null
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char
    } else if ('({[<'.includes(char)) {
      depth++
    } else if (')}]'.includes(char) || (char === '>' && input[i - 1] !== '=')) {
      depth--
    } else if (char === separator && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (current.trim()) parts.push(current)
  return parts
}

function matchingBrace(source: string, open: number) {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return source.length
}

function parseMember(raw: string): PropDoc | undefined {
  let text = raw.trim()
  let description: string | undefined
  const comment = text.match(/^\/\*\*[\s\S]*?\*\//)
  if (comment) {
    description = cleanComment(comment[0])
    text = text.slice(comment[0].length).trim()
  }
  if (!text || text.startsWith('[')) return undefined
  const method = text.match(/^(\w+)(\?)?\(([\s\S]*?)\)\s*:\s*([\s\S]+)$/)
  if (method)
    return {
      name: method[1],
      required: !method[2],
      type: cleanType(`(${method[3]}) => ${method[4]}`),
      description
    }
  const prop = text.match(/^(['"]?)([\w-]+)\1(\?)?\s*:\s*([\s\S]+)$/)
  if (!prop) return undefined
  return {
    name: prop[2],
    required: !prop[3],
    type: cleanType(prop[4]),
    description
  }
}

function parseDeclarations(
  source: string,
  module: string,
  index: DeclarationIndex
) {
  const declaration =
    /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?(?:export )?(?:declare )?(interface|function) (\w+)/g
  for (const match of source.matchAll(declaration)) {
    const [whole, comment, kind, name] = match
    const description = comment ? cleanComment(comment.trim()) : undefined
    if (kind === 'function') {
      index.functions.set(name, {description, module})
      continue
    }
    const start = (match.index ?? 0) + whole.length
    const open = source.indexOf('{', start)
    const header = source.slice(start, open)
    const extendsMatch = header.match(/extends([\s\S]+)$/)
    const extendsList = extendsMatch
      ? splitTopLevel(extendsMatch[1], ',').map(part => part.trim())
      : []
    const body = source.slice(open + 1, matchingBrace(source, open))
    const members = splitTopLevel(body, ';')
      .map(parseMember)
      .filter((member): member is PropDoc => member !== undefined)
    index.interfaces.set(name, {name, extendsList, members})
  }
}

function parseUnions(source: string, index: DeclarationIndex) {
  for (const [, name, union] of source.matchAll(
    /export type (\w+Props) = ([\w\s|]+);/g
  ))
    index.unions.set(
      name,
      union.split('|').map(part => part.trim())
    )
}

function formatDefault(value: string) {
  return value.replace(/^"(.*)"$/, "'$1'")
}

function parseDefaults(source: string, index: DeclarationIndex) {
  for (const match of source.matchAll(/function (\w+)\(\{/g)) {
    const open = (match.index ?? 0) + match[0].length - 1
    const params = source.slice(open, matchingBrace(source, open))
    const defaults = new Map<string, string>()
    const assignment =
      /(?:^|[,{\s])([\w$]+)\s*=\s*("[^"]*"|'[^']*'|-?[\d.]+|true|false|null)(?=\s*[,}\n])/g
    for (const [, name, value] of params.matchAll(assignment))
      defaults.set(name, formatDefault(value))
    if (defaults.size > 0) index.defaults.set(match[1], defaults)
  }
}

const loadIndex = cache(function loadIndex(): DeclarationIndex {
  const dir = componentsDir()
  const index: DeclarationIndex = {
    interfaces: new Map(),
    unions: new Map(),
    functions: new Map(),
    defaults: new Map()
  }
  for (const folder of [dir, path.join(dir, 'internal')]) {
    for (const file of readdirSync(folder)) {
      if (!file.endsWith('.d.ts') || /\.(spec|stories|test)\.d\.ts$/.test(file))
        continue
      const module = file.slice(0, -'.d.ts'.length)
      const source = readFileSync(path.join(folder, file), 'utf8')
      parseDeclarations(source, module, index)
      parseUnions(source, index)
      const js = path.join(folder, `${module}.js`)
      if (existsSync(js)) parseDefaults(readFileSync(js, 'utf8'), index)
    }
  }
  return index
})

function isPublicPart(name: string) {
  return findComponent(name) !== undefined
}

function collectProps(
  decl: InterfaceDecl,
  index: DeclarationIndex,
  omit: Set<string>,
  props: Map<string, PropDoc>,
  accepts: Array<string>
) {
  for (const member of decl.members)
    if (!omit.has(member.name) && !props.has(member.name))
      props.set(member.name, member)
  for (const entry of decl.extendsList) {
    let base = entry
    const nextOmit = new Set(omit)
    const omitted = entry.match(/^Omit<([\s\S]+)>$/)
    if (omitted) {
      const [inner, keys = ''] = splitTopLevel(omitted[1], ',')
      base = inner.trim()
      for (const key of keys.matchAll(/'([^']+)'/g)) nextOmit.add(key[1])
    }
    if (base in passThrough) {
      accepts.push(passThrough[base])
      continue
    }
    const element = base.match(
      /(?:ComponentPropsWithoutRef|HTMLAttributes|SVGProps)<'?(\w+)'?>/
    )
    if (element) {
      const tag = element[1].replace(/^HTML(\w+)Element$/, '$1').toLowerCase()
      accepts.push(
        `every prop of a \`<${tag === 'svgsvg' ? 'svg' : tag}>\` element`
      )
      continue
    }
    const inherited = index.interfaces.get(base)
    if (!inherited) continue
    const partName = base.replace(/Props$/, '')
    if (base.endsWith('Props') && isPublicPart(partName)) {
      accepts.push(`every prop of \`${partName}\``)
      continue
    }
    collectProps(inherited, index, nextOmit, props, accepts)
  }
}

/** The interfaces behind a props type, following aliases and unions */
function resolveUnion(name: string, index: DeclarationIndex): Array<string> {
  const union = index.unions.get(name)
  if (!union) return [name]
  return union.flatMap(alternative => resolveUnion(alternative, index))
}

/** The documented props of every part of a component, eg. Dialog* */
export function componentParts(name: string): Array<PartDoc> {
  const component = findComponent(name)
  if (!component) return []
  const index = loadIndex()
  return component.parts.map(part => {
    const fn = index.functions.get(part)
    const props = new Map<string, PropDoc>()
    const accepts: Array<string> = []
    const alternatives = resolveUnion(`${part}Props`, index)
    for (const alternative of alternatives) {
      const decl = index.interfaces.get(alternative)
      if (!decl) continue
      const own = new Map<string, PropDoc>()
      collectProps(decl, index, new Set(), own, accepts)
      for (const prop of own.values()) {
        const existing = props.get(prop.name)
        if (!existing) props.set(prop.name, prop)
        else if (existing.type !== prop.type)
          props.set(prop.name, {
            ...existing,
            type: [existing.type, prop.type]
              .map(type => (type.includes('=>') ? `(${type})` : type))
              .join(' | '),
            description: existing.description ?? prop.description
          })
      }
    }
    const defaults = index.defaults.get(part)
    const list = [...props.values()]
      // Plain children are implied, keep them when they are special
      .filter(
        prop =>
          prop.name !== 'children' ||
          (prop.required && prop.type !== 'ReactNode') ||
          props.size === 1
      )
      .map(prop => ({...prop, defaultValue: defaults?.get(prop.name)}))
    return {
      name: part,
      description: fn?.description,
      props: list,
      accepts: [...new Set(accepts)]
    }
  })
}

/**
 * A short summary for the catalog cards: the number of variants, sizes or
 * parts of a component
 */
export function componentMeta(name: string): string | undefined {
  const component = findComponent(name)
  if (!component) return undefined
  const [main] = componentParts(name)
  const count = (prop: string) => {
    const type = main?.props.find(p => p.name === prop)?.type
    if (!type || !type.includes("'")) return 0
    return splitTopLevel(type, '|').length
  }
  const variants = count('variant')
  if (variants > 1) return `${variants} variants`
  const sizes = count('size')
  if (sizes > 1) return `${sizes} sizes`
  if (component.parts.length > 1) return `${component.parts.length} parts`
  return undefined
}
