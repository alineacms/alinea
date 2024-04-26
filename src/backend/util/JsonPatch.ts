// This follows the logic of sqlite's json_patch function, merging
// objects deeply and removing keys that are set to null.
// It is not related to the JSON Patch standard.
// !!!!! It mutates the provided source
export function applyJsonPatch(source: any, patch: object) {
  if (!patch || typeof patch !== 'object') return source
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!source[key]) source[key] = {}
      applyJsonPatch(source[key], value)
    } else {
      if (value === null) delete source[key]
      else source[key] = value
    }
  }
  return source
}
