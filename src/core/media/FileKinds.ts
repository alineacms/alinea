import {imageExtensions} from './IsImage.js'

/** Groups of file extensions in the media library */
export type MediaFileKind =
  | 'image'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'video'
  | 'audio'
  | 'code'

/** The extensions of each kind of file, lower case without the leading dot */
export const fileKindExtensions: Record<
  MediaFileKind,
  ReadonlyArray<string>
> = {
  image: imageExtensions.map(extension => extension.slice(1)),
  pdf: ['pdf'],
  document: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'],
  spreadsheet: ['xls', 'xlsx', 'ods', 'csv', 'tsv', 'numbers'],
  presentation: ['ppt', 'pptx', 'odp', 'key'],
  archive: ['zip', 'rar', '7z', 'gz', 'tgz', 'tar'],
  video: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
  code: ['json', 'xml', 'html', 'css', 'js', 'ts', 'yml', 'yaml']
}

/**
 * The values the `extension` of media files of a kind is stored as: with a
 * leading dot, in lower case and, for files uploaded by older versions, in
 * upper case
 */
export function storedExtensions(kind: MediaFileKind): Array<string> {
  return fileKindExtensions[kind].flatMap(extension => [
    `.${extension}`,
    `.${extension.toUpperCase()}`
  ])
}
