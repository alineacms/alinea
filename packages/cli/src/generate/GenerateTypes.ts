import {Field} from '@alinea/core/Field'
import {createError, RichTextShape} from '@alinea/core/index'
import {Shape} from '@alinea/core/Shape'
import {ListShape} from '@alinea/core/shape/ListShape'
import {RecordShape} from '@alinea/core/shape/RecordShape'
import {ScalarShape} from '@alinea/core/shape/ScalarShape'
import {Type} from '@alinea/core/Type'
import {Workspace} from '@alinea/core/Workspace'
import {code} from '../util/CodeGen'

export function generateTypes(workspace: Workspace) {
  const types = Object.values(workspace.schema.types)
    .map(generateType)
    .join('\n')
  const pageUnion = Object.keys(workspace.schema.types).join(' | ')
  return code`
    import {TextDoc} from '@alinea/core'
    ${types}
    type AnyPage = ${pageUnion}
  `
}

function generateType(type: Type) {
  return code`
    export interface ${type.name} {
      ${Object.entries(type.fields).map(generateField).join('\n')}
    }
  `
}

type FieldInfo = [name: string, field: Field<any, any>]

function generateField([name, field]: FieldInfo) {
  return code`'${name}': ${typeOf(field.shape)}`
}

function typeUnion(options: Record<string, Shape>) {
  return Object.entries(options)
    .map(([name, record]) => {
      return `({type: '${name}'} & ${typeOf(record)})`
    })
    .join(' | ')
}

function typeOf(shape: Shape): string {
  if (shape instanceof ScalarShape) return shape.scalarType
  if (shape instanceof ListShape)
    return `Array<
      ${typeUnion(shape.values)}
    >`
  if (shape instanceof RecordShape)
    return Object.entries(shape.properties)
      .map(([name, shape]) => {
        return `'${name}': ${typeOf(shape)}`
      })
      .join(', ')
  if (shape instanceof RichTextShape) {
    if (shape.values) return `TextDoc<${typeUnion(shape.values)}>`
    return `TextDoc`
  }
  console.log(shape)
  throw createError(`Unknown type: ${shape}`)
}
