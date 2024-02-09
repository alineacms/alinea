import {Config} from 'alinea/core/Config'
import {Hint} from 'alinea/core/Hint'
import {Type} from 'alinea/core/Type'
import {Code, code} from 'alinea/core/util/CodeGen'
import {Lazy} from 'alinea/core/util/Lazy'

export function generateTypes({schema}: Config) {
  const types = code()
  const hints = Object.values(schema).map(Type.hint)
  const seen = new Map<string, Hint.TypeDefinition>()
  const rootTypes = []
  for (const definition of Hint.definitions(hints)) {
    if (seen.has(definition.name)) {
      const previous = seen.get(definition.name)!
      if (Hint.equals(previous, definition)) continue
      throw new Error(
        code`
          ${previous.parents.join('.')} ${generateHint(
          Hint.Object(Lazy.get(previous.fields))
        )}

          ${definition.parents.join('.')} ${generateHint(
          Hint.Object(Lazy.get(definition.fields))
        )}
              
          Duplicate definition for "${definition.name}"
        `.toString()
      )
    }
    seen.set(definition.name, definition)
    const fields = Object.entries(Lazy.get(definition.fields)).filter(
      ([name]) => name !== 'type'
    )
    const isRootType = definition.parents.length === 0
    const extend = isRootType
      ? 'Entry'
      : definition.extend.map(generateHint).join(', ')
    types.push(code`
      export interface ${definition.name} ${
      extend.length > 0 ? 'extends ' + extend + ' ' : ''
    }{
        type: ${JSON.stringify(definition.name)}
        ${fields
          .map(([name, hint]) => code`${name}: ${generateHint(hint)}`)
          .join('\n')}
      }
    `)

    if (isRootType) rootTypes.push(definition.name)
  }
  const imports = code()
  for (const [pkg, externs] of Hint.externs(hints).entries()) {
    imports.push(code`
      import {${Array.from(externs).join(', ')}} from ${JSON.stringify(pkg)}
    `)
  }

  return code`
    import {Pages as AlineaPages} from 'alinea/backend'
    import {Entry} from 'alinea/core'
    ${imports}
    export namespace Page {
      ${types}
    }
    export type Page = 
      ${rootTypes.map(name => `| Page.${name}`).join('\n')}
    export type Pages = AlineaPages<Page>
  `
}

export function generateHint(hint: Hint): Code {
  switch (hint.type) {
    case 'string':
      return code`string`
    case 'number':
      return code`number`
    case 'boolean':
      return code`boolean`
    case 'array':
      return code`
        Array<${generateHint(hint.inner)}>
      `
    case 'literal':
      return code(JSON.stringify(hint.value))
    case 'definition':
      return code(hint.name)
    case 'object':
      return generateObject(hint)
    case 'union':
      return generateUnion(hint)
    case 'intersection':
      return generateIntersection(hint)
    case 'extern':
      if (hint.typeParams.length === 0) return code(hint.from.name)
      return code`${hint.from.name}<${hint.typeParams
        .map(generateHint)
        .join(', ')}>`
    default:
      throw new Error(`Unknown hint type ${hint}`)
  }
}

function generateObject(hint: Hint.Object): Code {
  const fields = Object.entries(hint.fields)
  if (fields.length === 0) return code`{}`
  return code`
    {
      ${fields
        .map(([name, hint]) => code`${name}: ${generateHint(hint)}`)
        .join('\n')}
    }
  `
}

function generateUnion(hint: Hint.Union): Code {
  if (hint.options.length === 0) return code`never`
  return code(hint.options.map(inner => `${generateHint(inner)}`).join(' | '))
}

function generateIntersection(hint: Hint.Intersection): Code {
  if (hint.options.length === 0) return code`never`
  return code(hint.options.map(inner => `${generateHint(inner)}`).join(' & '))
}
