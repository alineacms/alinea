import type {IconType} from '#/components/types.js'
import {
  IcRoundAudioFile,
  IcRoundCode,
  IcRoundDescription,
  IcRoundFolderZip,
  IcRoundInsertDriveFile,
  IcRoundPictureAsPdf,
  IcRoundSlideshow,
  IcRoundTableChart,
  IcRoundVideoFile
} from '../icons.js'

/** Groups of file extensions that share an icon and color in the media library */
export type FileKind =
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'video'
  | 'audio'
  | 'code'
  | 'other'

const kinds: Record<Exclude<FileKind, 'other'>, Array<string>> = {
  pdf: ['pdf'],
  document: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'],
  spreadsheet: ['xls', 'xlsx', 'ods', 'csv', 'tsv', 'numbers'],
  presentation: ['ppt', 'pptx', 'odp', 'key'],
  archive: ['zip', 'rar', '7z', 'gz', 'tgz', 'tar'],
  video: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
  code: ['json', 'xml', 'html', 'css', 'js', 'ts', 'yml', 'yaml']
}

const kindOfExtension = new Map(
  Object.entries(kinds).flatMap(([kind, extensions]) =>
    extensions.map(extension => [extension, kind as FileKind])
  )
)

const icons: Record<FileKind, IconType> = {
  pdf: IcRoundPictureAsPdf,
  document: IcRoundDescription,
  spreadsheet: IcRoundTableChart,
  presentation: IcRoundSlideshow,
  archive: IcRoundFolderZip,
  video: IcRoundVideoFile,
  audio: IcRoundAudioFile,
  code: IcRoundCode,
  other: IcRoundInsertDriveFile
}

/** The kind of a file by its extension, with or without the leading dot */
export function fileKind(extension: string | null | undefined): FileKind {
  const key = extension?.replace(/^\./, '').toLowerCase()
  return (key && kindOfExtension.get(key)) || 'other'
}

export function fileKindIcon(kind: FileKind): IconType {
  return icons[kind]
}

/** The placeholder color behind the icon of a file of this kind */
export function fileKindColor(kind: FileKind): string {
  return `var(--alinea-file-${kind})`
}
