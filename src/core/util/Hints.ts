import {Hint} from '../Hint.js'
import {Schema} from '../Schema.js'

export function richTextHint(schema?: Schema) {
  const from = {name: 'TextDoc', package: 'alinea/core'}
  if (!schema) return Hint.Extern(from)
  return Hint.Extern(from, rowsOf(schema.hint as Hint.Union))
}

export function listHint(schema: Schema) {
  return Hint.Array(rowsOf(schema.hint as Hint.Union))
}

function rowsOf(union: Hint.Union) {
  const options = union.options as Array<Hint.Definition>
  const types = options.map(def => {
    return Hint.Definition(
      def.name,
      def.fields,
      Hint.Extern({name: 'ListRow', package: 'alinea/input/list'})
    )
  })
  return Hint.Union(types)
}
