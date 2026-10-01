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

/** The icon of a file without an image preview, and the color behind it */
export interface FileKindVisual {
  icon: IconType
  color: string
}

function tint(color: string, percent: number) {
  return `color-mix(in oklab, var(--alinea-${color}) ${percent}%, var(--alinea-bg))`
}

const muted = 'var(--alinea-bg-muted)'
const other: FileKindVisual = {icon: IcRoundInsertDriveFile, color: muted}

// Images show their preview where they have one, other files the icon of
// their kind
const visuals: Record<string, FileKindVisual> = {
  image: {icon: IcRoundImage, color: muted},
  pdf: {icon: IcRoundPictureAsPdf, color: tint('red-500', 16)},
  document: {icon: IcRoundDescription, color: tint('blue-500', 18)},
  spreadsheet: {icon: IcRoundTableChart, color: tint('green-500', 18)},
  presentation: {icon: IcRoundSlideshow, color: tint('orange-700', 16)},
  archive: {icon: IcRoundFolderZip, color: tint('yellow-500', 22)},
  video: {icon: IcRoundVideoFile, color: muted},
  audio: {icon: IcRoundAudioFile, color: muted},
  code: {icon: IcRoundCode, color: muted}
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
