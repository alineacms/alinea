import type {IconType} from '#/components/types.js'
import {fileKindExtensions} from '#/core/media/FileKinds.js'
import {
  IcRoundAudioFile,
  IcRoundCode,
  IcRoundDescription,
  IcRoundFolderZip,
  IcRoundImage,
  IcRoundInsertDriveFile,
  IcRoundPictureAsPdf,
  IcRoundSlideshow,
  IcRoundTableChart,
  IcRoundVideoFile
} from '../icons.js'

/** The icon of a file without an image preview, in the color of its kind */
export interface FileKindVisual {
  icon: IconType
  iconColor?: string
}

const other: FileKindVisual = {icon: IcRoundInsertDriveFile}

// Images show their preview where they have one, other files the icon of
// their kind
const visuals: Record<string, FileKindVisual> = {
  image: {icon: IcRoundImage},
  pdf: {icon: IcRoundPictureAsPdf, iconColor: 'var(--alinea-red-500)'},
  document: {icon: IcRoundDescription, iconColor: 'var(--alinea-blue-700)'},
  spreadsheet: {icon: IcRoundTableChart, iconColor: 'var(--alinea-green-600)'},
  presentation: {icon: IcRoundSlideshow, iconColor: 'var(--alinea-orange-700)'},
  archive: {icon: IcRoundFolderZip, iconColor: 'var(--alinea-yellow-600)'},
  video: {icon: IcRoundVideoFile},
  audio: {icon: IcRoundAudioFile},
  code: {icon: IcRoundCode}
}

const visualOfExtension = new Map(
  Object.entries(fileKindExtensions).flatMap(([kind, extensions]) =>
    visuals[kind]
      ? extensions.map(extension => [extension, visuals[kind]] as const)
      : []
  )
)

/** The visual of a file by its extension, with or without the leading dot */
export function fileKindVisual(
  extension: string | null | undefined
): FileKindVisual {
  const key = extension?.replace(/^\./, '').toLowerCase()
  return (key && visualOfExtension.get(key)) || other
}
