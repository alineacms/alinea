import {Hint} from '../Hint.js'
import {Schema} from '../Schema.js'

export function richTextHint(schema?: Schema) {
  const from = {name: 'TextDoc', package: 'alinea/core'}
  if (!schema) return Hint.Extern(from)
  return Hint.Extern(from, rowsOf(Schema.hint(schema)))
}

export function listHint(schema: Schema) {
  return Hint.Array(rowsOf(Schema.hint(schema)))
}

function rowsOf(union: Hint.Union) {
  const options = union.options as Array<Hint.Definition>
  const types = options.map(def => {
    return Hint.Definition(
      def.name,
      def.fields,
      Hint.Extern({name: 'ListRow', package: 'alinea/field/list'})
    )
  })
  return Hint.Union(types)
}
