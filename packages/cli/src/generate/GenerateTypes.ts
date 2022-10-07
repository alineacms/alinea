import {createError} from '@alinea/core/ErrorWithCode'
import {Hint} from '@alinea/core/Hint'
import {Code, code} from '@alinea/core/util/CodeGen'
import {Lazy} from '@alinea/core/util/Lazy'
import {Workspace} from '@alinea/core/Workspace'

export function generateTypes(workspace: Workspace) {
  const res = code()
  const seen = new Map<string, Hint.TypeDefinition>()
  for (const definition of workspace.schema.definitions()) {
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
              
          Duplicate definition for "${definition.name}" in workspace "${
          workspace.name
        }"
        `.toString()
      )
    }
    seen.set(definition.name, definition)
    const fields = Object.entries(Lazy.get(definition.fields)).filter(
      ([name]) => name !== 'type'
    )
    res.push(code`
      export interface ${definition.name} {
        type: ${JSON.stringify(definition.name)}
        ${fields
          .map(([name, hint]) => code`${name}: ${generateHint(hint)}`)
          .join('\n')}
      }
    `)
  }
  return res
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

/*const types = workspace.schema.allTypes.flatMap(type => {
    return [...type.shape.innerTypes([type.name]), type]
  })
  const seen = new Map<string, ShapeInfo>()
  for (const info of types) {
    if (seen.has(info.name)) {
      const a = seen.get(info.name)!,
        b = info
      if (a.shape !== b.shape)
        throw new Error(
          code`
            In workspace ${workspace.name}
            Found different types with the same key (${info.name})
              
              ${a.parents.join('.')}: ${a.shape.typescriptType(true)}
              
              ${b.parents.join('.')}: ${b.shape.typescriptType(true)}
          `.toString()
        )
    } else {
      seen.set(info.name, info)
    }
  }
  const generatedTypes = types.map(generateType).join('\n')
  const pageUnion = workspace.schema.allTypes.map(type => type.name).join(' | ')
  return code`
    import {TextDoc} from '@alinea/core'
    ${generatedTypes}
    export type AnyPage = ${pageUnion}
  `
}

export function generateType({name, shape}: ShapeInfo) {
  return code`
    export interface ${name} ${shape.typescriptType(true, name)}
  `
}*/
