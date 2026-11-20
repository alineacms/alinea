/** A file a visitor adds to a file input */
export interface FormFileInfo {
  name: string
  size: number
  /** The media type the browser gives, often guessed from the name */
  type: string
}

const signatures: Array<[type: string, at: number, bytes: Array<number>]> = [
  ['image/png', 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/jpeg', 0, [0xff, 0xd8, 0xff]],
  ['image/gif', 0, [0x47, 0x49, 0x46, 0x38]],
  ['image/webp', 8, [0x57, 0x45, 0x42, 0x50]],
  ['application/pdf', 0, [0x25, 0x50, 0x44, 0x46, 0x2d]],
  // Office documents are zip files too
  ['application/zip', 0, [0x50, 0x4b, 0x03, 0x04]]
]

/** What the first bytes of files with these extensions are */
const extensions: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  zip: 'application/zip',
  docx: 'application/zip',
  xlsx: 'application/zip',
  pptx: 'application/zip',
  odt: 'application/zip',
  ods: 'application/zip',
  txt: 'text/plain',
  csv: 'text/plain'
}

/** The type of a file by its first bytes, for the types we can tell apart */
export function sniffType(bytes: Uint8Array): string | undefined {
  for (const [type, at, signature] of signatures)
    if (signature.every((byte, index) => bytes[at + index] === byte))
      return type
  if (looksLikeText(bytes)) return 'text/plain'
  return undefined
}

function looksLikeText(bytes: Uint8Array): boolean {
  const start = bytes.subarray(0, 1024)
  if (start.length === 0) return false
  // Text has no NUL bytes and is valid UTF-8
  if (start.includes(0)) return false
  try {
    new TextDecoder('utf-8', {fatal: true}).decode(start)
    return true
  } catch {
    // The start may cut a character in two
    return start.length === 1024
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/**
 * Whether a file matches the accept list of an input (`.png, .jpg`,
 * `image/*`), like the browser checks it. An empty list accepts any file.
 */
export function isAccepted(accept: string, file: FormFileInfo): boolean {
  const tokens = accept
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
  if (tokens.length === 0) return true
  const extension = `.${extensionOf(file.name)}`
  const type = file.type.toLowerCase()
  return tokens.some(token => {
    if (token.startsWith('.')) return token === extension
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1))
    return token === type
  })
}

/**
 * Why the bytes of a file do not fit its name, eg. a script renamed to
 * `.pdf`, or undefined when they do. Extensions we cannot check pass.
 */
export function contentProblem(
  file: FormFileInfo,
  bytes: Uint8Array
): string | undefined {
  const expected = extensions[extensionOf(file.name)]
  const actual = sniffType(bytes)
  if (expected && expected !== actual)
    return `${file.name} is not the kind of file its name says`
  // A known binary type under a name we cannot check is let through, the
  // accept list is checked on the name
  return undefined
}
