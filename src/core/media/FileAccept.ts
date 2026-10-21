import {fileKindExtensions, type MediaFileKind} from './FileKinds.js'

/** The groups of `accept` like `image/*` known by their extensions */
const mediaKinds: Record<string, MediaFileKind> = {
  image: 'image',
  video: 'video',
  audio: 'audio'
}

/**
 * Whether a file matches an `accept` list, like the accept attribute of a
 * file input: extensions (`.pdf`), media types (`application/pdf`) and media
 * type groups (`image/*`). A file matches everything without a list. Without
 * the media type of the file, groups match by the extensions of their kind.
 */
export function fileAccepts(
  accept: string | undefined,
  fileName: string,
  mimeType?: string
): boolean {
  if (!accept?.trim()) return true
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
    : ''
  const mime = mimeType?.toLowerCase()
  return accept
    .split(',')
    .map(token => token.trim().toLowerCase())
    .some(token => {
      if (!token) return false
      if (token.startsWith('.')) return token.slice(1) === extension
      if (token === '*' || token === '*/*') return true
      const [group, subtype] = token.split('/')
      if (subtype === '*') {
        if (mime) return mime.startsWith(`${group}/`)
        const kind = mediaKinds[group]
        return Boolean(kind && fileKindExtensions[kind].includes(extension))
      }
      return mime === token
    })
}
