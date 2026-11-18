import {type Json, merge} from '@alinea/graft'
import {Type} from '../Type.js'
import {isRecord} from '../util/Objects.js'
import {renameEdits} from './Rename.js'

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
  const shape = Type.shape(type)
  const [from, into] = renameEdits(shape, json(base), json(ours))
  const merged = merge(shape, from, into, json(theirs), {prefer: 'ours'})
  return isRecord(merged) ? merged : ours
}

// Leaves out undefined values, which a merge would read as changes
function json(data: Data): Json {
  return JSON.parse(JSON.stringify(data))
}
