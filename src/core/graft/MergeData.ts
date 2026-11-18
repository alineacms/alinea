import {type Json, merge} from '@alinea/graft'
import {Type} from '../Type.js'
import {isRecord} from '../util/Objects.js'

type Data = Record<string, unknown>

/**
 * Merges the fields of a save with what was saved since the editor read the
 * entry: `base` is the data the editor started from, `ours` what they save
 * and `theirs` what is stored now. Fields the editor left alone keep what
 * others saved meanwhile, also fields the editor's schema does not know, and
 * where both changed a value the save wins.
 */
export function mergeData(
  type: Type,
  base: Data,
  ours: Data,
  theirs: Data
): Data {
  // Values under old field names move to their current name in the merge,
  // also an edit a dashboard on an older schema made under the old one
  const merged = merge(Type.shape(type), json(base), json(ours), json(theirs), {
    prefer: 'ours'
  })
  return isRecord(merged) ? merged : ours
}

// Leaves out undefined values, which a merge would read as changes
function json(data: Data): Json {
  return JSON.parse(JSON.stringify(data))
}
