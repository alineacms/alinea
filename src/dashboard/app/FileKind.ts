import type {IconType} from '#/components/types.js'
import {fileKindExtensions, type MediaFileKind} from '#/core/media/FileKinds.js'
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
export type FileKind = Exclude<MediaFileKind, 'image'> | 'other'

// Images show their preview, other files the icon of their kind
const kindOfExtension = new Map(
  Object.entries(fileKindExtensions).flatMap(([kind, extensions]) =>
    kind === 'image'
      ? []
      : extensions.map(extension => [extension, kind as FileKind])
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
