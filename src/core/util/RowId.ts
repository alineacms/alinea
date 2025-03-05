let id = 0
const prefix = '@@@'

export function rowId() {
  return `${prefix}${id++}`
}

export function isRowId(input: string) {
  return input.startsWith(prefix)
}
