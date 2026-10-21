import {IcRoundInsertDriveFile, IcRoundPermMedia} from '#/dashboard/icons.js'
import {hidden} from '#/field/hidden/HiddenField.js'
import {auditMetadata} from '#/field/metadata/MetadataAudit.js'
import {path} from '#/field/path/PathField.js'
import {text} from '#/field/text/TextField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import prettyBytes from 'pretty-bytes'
import {Entry} from '../Entry.js'
import {Expr} from '../Expr.js'
import {
  column,
  Overview,
  type OverviewFilterOption,
  type OverviewOptions
} from '../Overview.js'
import {
  type FieldsDefinition,
  type Type,
  type TypeConfig,
  type
} from '../Type.js'
import {fileAccepts} from './FileAccept.js'
import {type MediaFileKind, storedExtensions} from './FileKinds.js'
import {mediaAlt, type MediaAltValue} from './MediaAltField.js'
import {MediaLocation} from './MediaLocation.js'

const fileMarker = Symbol.for('@alinea.File')

interface FileTypeData {
  accept?: string
}

export interface FileTypeConfig<Fields> extends Omit<
  TypeConfig<Fields>,
  'fields'
> {
  fields?: Fields
  /**
   * The files of this type, like the accept attribute of a file input:
   * extensions (`.pdf,.docx`), media types (`application/pdf`) or groups of
   * them (`image/*`). Without, the type takes every file.
   */
  accept?: string
}

/** The data alinea keeps of every uploaded file */
function fileFields() {
  return {
    title: text('Title', {width: 0.5}),
    path: path('Path', {width: 0.5}),
    metadata: auditMetadata(),
    location: hidden<string>('Location'),
    previewUrl: hidden<string>('Preview URL'),
    extension: hidden<string>('Extension'),
    size: hidden<number>('File size'),
    hash: hidden<string>('Hash'),
    /** The hash of the file as uploaded, before it was scaled down */
    sourceHash: hidden<string>('Source hash'),
    width: hidden<number>('Image width'),
    height: hidden<number>('Image height'),
    preview: hidden<string>('Preview'),
    averageColor: hidden<string>('Average color'),
    focus: hidden<{x: number; y: number}>('Focus'),
    thumbHash: hidden<string>('Blur hash')
  }
}

export type FileFields = ReturnType<typeof fileFields>

/** The keys of the fields every file type has */
export const fileFieldKeys: ReadonlySet<string> = new Set(
  Object.keys(fileFields())
)

function fileType<Fields extends FieldsDefinition>(
  label: string,
  fields: Fields,
  {accept, ...config}: Omit<FileTypeConfig<Fields>, 'fields'>
): Type<Fields> {
  const result = type(label, {
    // Files are created by uploading them
    hidden: true,
    // Lists that know the extension show the icon of the kind of file instead
    icon: IcRoundInsertDriveFile,
    entryUrl({config, data, defaultUrl, parentPaths, path, workspace}) {
      return MediaLocation.entryUrl(config, {
        data,
        defaultUrl,
        parentPaths,
        path,
        workspace
      })
    },
    ...config,
    fields
  })
  const data: FileTypeData = {accept}
  return Object.assign(result, {[fileMarker]: data})
}

/**
 * A type of uploaded file. Its entries keep the data of the file next to the
 * fields of the type. An upload becomes the first file type the location
 * contains that accepts the file.
 */
export function file<Fields extends FieldsDefinition = {}>(
  label: string,
  {fields = {} as Fields, ...config}: FileTypeConfig<Fields> = {}
): Type<FileFields & Fields> {
  return fileType(label, {...fileFields(), ...fields}, config)
}

/** Whether `type` was created with `Config.file` */
export function isFileType(type: Type | undefined): boolean {
  return Boolean(type && fileMarker in type)
}

/** Whether a file type takes a file */
export function fileTypeAccepts(
  type: Type,
  fileName: string,
  mimeType?: string
): boolean {
  const data = (type as Type & {[fileMarker]?: FileTypeData})[fileMarker]
  return Boolean(data) && fileAccepts(data?.accept, fileName, mimeType)
}

function fileExpr<Value>(name: string) {
  return new Expr<Value>({type: 'entryField', name, path: []})
}

/** The data of uploaded files, of whichever file type */
export const FileData = {
  location: fileExpr<string>('location'),
  previewUrl: fileExpr<string>('previewUrl'),
  extension: fileExpr<string>('extension'),
  size: fileExpr<number>('size'),
  hash: fileExpr<string>('hash'),
  sourceHash: fileExpr<string>('sourceHash'),
  alt: fileExpr<MediaAltValue>('alt'),
  width: fileExpr<number>('width'),
  height: fileExpr<number>('height'),
  preview: fileExpr<string>('preview'),
  averageColor: fileExpr<string>('averageColor'),
  focus: fileExpr<{x: number; y: number}>('focus'),
  thumbHash: fileExpr<string>('thumbHash')
}

export type MediaFile = Type.Infer<typeof MediaFile>
const {width, height, preview, averageColor, focus, thumbHash, ...leading} =
  fileFields()
// The fields keep the order of earlier versions, which stored files have
export const MediaFile = fileType(
  'Media file',
  {
    ...leading,
    alt: mediaAlt('Alt text', {
      multiline: true,
      help: 'Describe the image for screen readers and SEO'
    }),
    width,
    height,
    preview,
    averageColor,
    focus,
    thumbHash
  },
  {}
)

export type MediaLibrary = Type.Infer<typeof MediaLibrary>
export const MediaLibrary = type('Media directory', {
  icon: IcRoundPermMedia,
  contains: ['MediaLibrary', 'MediaFile'],
  defaultView: 'overview',
  overview: mediaOverview(),
  fields: {
    title: text('Title', {required: true}),
    path: path('Path')
  }
})

/**
 * Picks media files of a kind. Folders always match, so editors can still
 * browse into them while the filter applies.
 */
function fileKindOption(
  label: string,
  kind: MediaFileKind
): OverviewFilterOption {
  return {
    label,
    filter: {
      or: [
        {_type: 'MediaLibrary'},
        {_type: 'MediaFile', extension: {in: storedExtensions(kind)}}
      ]
    }
  }
}

/**
 * The overview of the media library: a preview, the dimensions, size and type
 * of each file, orders and filters on those
 */
export function mediaOverview(): OverviewOptions {
  // Folders order by 0 and files by null, which sorts last in either direction
  const foldersFirst = Overview.sortExpr({
    MediaLibrary: new Expr({type: 'value', value: 0})
  })
  return {
    builtins: {type: false},
    // Folders first in their manual order, files have none and come after,
    // newest first: entry ids start with their creation time. Indexes are
    // keys that only order as stored.
    sort: [
      {
        asc: Overview.sortExpr({MediaLibrary: Entry.index}),
        caseSensitive: true
      },
      {desc: Entry.id}
    ],
    sorts: {
      latest: {
        label: 'Latest',
        by: [foldersFirst, Entry.id],
        direction: 'desc'
      },
      title: {label: 'Title', by: Entry.title},
      size: {label: 'Size', by: FileData.size, direction: 'desc'},
      dimensions: {
        label: 'Dimensions',
        by: [FileData.width, FileData.height],
        direction: 'desc'
      },
      fileType: {label: 'File type', by: [FileData.extension, Entry.title]}
    },
    filters: {
      show: {
        label: 'Show',
        options: {
          files: {label: 'Files', filter: {_type: 'MediaFile'}},
          folders: {label: 'Folders', filter: {_type: 'MediaLibrary'}}
        }
      },
      usage: {
        label: 'Usage',
        options: {
          // Files no entry links to, folders stay to browse into
          unused: {
            label: 'Unused',
            filter: {
              or: [
                {_type: 'MediaLibrary'},
                {_type: 'MediaFile', _referenced: false}
              ]
            }
          }
        }
      },
      fileType: {
        label: 'File type',
        multiple: true,
        options: {
          image: fileKindOption('Images', 'image'),
          pdf: fileKindOption('PDF', 'pdf'),
          document: fileKindOption('Documents', 'document'),
          spreadsheet: fileKindOption('Spreadsheets', 'spreadsheet'),
          presentation: fileKindOption('Presentations', 'presentation'),
          archive: fileKindOption('Archives', 'archive'),
          video: fileKindOption('Video', 'video'),
          audio: fileKindOption('Audio', 'audio')
        }
      }
    },
    // The file's columns come before who last updated it and when
    columns: {
      preview: column({
        header: 'Preview',
        position: 'start',
        width: 64,
        collapsible: false,
        sortable: false,
        select: {
          preview: FileData.preview,
          averageColor: FileData.averageColor,
          extension: FileData.extension
        },
        view: viewKeys.MediaPreviewCell
      }),
      dimensions: column({
        header: 'Dimensions',
        position: 'start',
        width: 150,
        select: {width: FileData.width, height: FileData.height},
        sortBy: FileData.width,
        format: ({width, height}) =>
          width && height ? `${width} × ${height} px` : ''
      }),
      size: column({
        header: 'Size',
        position: 'start',
        width: 110,
        align: 'end',
        select: FileData.size,
        format: size =>
          typeof size === 'number' && Number.isFinite(size) && size >= 0
            ? prettyBytes(size)
            : ''
      }),
      fileType: column({
        header: 'File type',
        position: 'start',
        width: 110,
        select: FileData.extension,
        format: extension =>
          extension ? extension.replace(/^\./, '').toUpperCase() : ''
      })
    }
  }
}
