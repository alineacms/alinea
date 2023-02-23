const separate = new Set([
  ' ',
  '!',
  '[',
  ']',
  ',',
  '.',
  ':',
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
  '’',
  '`',
  '´',
  '"',
  '“',
  '”',
  '*',
  '{',
  '}',
  '\n',
  '\r',
  '\t'
])

const space = ' '.charCodeAt(0)

export function isSeparator(char: string) {
  return separate.has(char)
}

export function slugify(input: string, separator = '-'): string {
  let buffer = ''
  for (const char of input) {
    if (isSeparator(char)) {
      if (buffer === '') continue
      if (!buffer.endsWith(separator)) buffer += separator
      continue
    }
    if (char.charCodeAt(0) < space) continue
    buffer += char
  }
  if (buffer.endsWith(separator)) buffer = buffer.slice(0, -separator.length)
  return buffer.toLowerCase()
}
