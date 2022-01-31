const separate = new Set([
  ' ',
  '!',
  '[',
  ']',
  ',',
  '.',
  '/',
  '\\',
  ';',
  '<',
  '>',
  '?',
  '_',
  '-',
  '|',
  '(',
  ')',
  '#',
  "'",
  '*',
  '{',
  '}'
])

const space = ' '.charCodeAt(0)

export function isSeparator(char: string) {
  return separate.has(char)
}

export function slugify(input: string, separator = '-'): string {
  let buffer = ''
  const result: Array<string> = []
  function push() {
    if (buffer.length === 0) return
    result.push(buffer)
    buffer = ''
  }
  for (const char of input) {
    if (char.charCodeAt(0) < space) continue
    if (isSeparator(char)) push()
    else buffer += char
  }
  push()
  return result.join(separator).toLowerCase()
}
