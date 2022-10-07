import {Config} from '@alinea/core/Config'
import {createError} from '@alinea/core/ErrorWithCode'
import {Hint} from '@alinea/core/Hint'
import {Code, code} from '@alinea/core/util/CodeGen'
import {Lazy} from '@alinea/core/util/Lazy'

function wrapNamespace(inner: Code, namespace: string | undefined) {
  if (namespace)
    return code`
      export namespace ${namespace} {
        ${inner}
      }
    `
  return inner
}

export function generateTypes({schema}: Config) {
  const types = code()
  const seen = new Map<string, Hint.TypeDefinition>()
  const rootTypes = []
  for (const definition of schema.definitions()) {
    if (seen.has(definition.name)) {
      const previous = seen.get(definition.name)!
      if (Hint.equals(previous, definition)) continue
      throw createError(
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
    types.push(code`
      export interface ${definition.name} extends Entry {
        type: ${JSON.stringify(definition.name)}
        ${fields
          .map(([name, hint]) => code`${name}: ${generateHint(hint)}`)
          .join('\n')}
      }
    `)
    if (definition.parents.length === 0) rootTypes.push(definition.name)
  }
  return code`
    import type {Pages as AlineaPages} from '@alinea/backend'
    import type {Entry, TextDoc} from '@alinea/core'
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
    case 'extern':
      if (hint.typeParams.length === 0) return code(hint.name)
      return code`${hint.name}<${hint.typeParams.map(generateHint).join(', ')}>`
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
