import {IcRoundPermMedia} from '#/dashboard/icons.js'
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
import {type Type, type} from '../Type.js'
import {type MediaFileKind, storedExtensions} from './FileKinds.js'
import {mediaAlt} from './MediaAltField.js'
import {MediaLocation} from './MediaLocation.js'

export type MediaFile = Type.Infer<typeof MediaFile>
export const MediaFile = type('Media file', {
  hidden: true,
  entryUrl({config, data, defaultUrl, parentPaths, path, workspace}) {
    return MediaLocation.entryUrl(config, {
      data,
      defaultUrl,
      parentPaths,
      path,
      workspace
    })
  },
  fields: {
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
    alt: mediaAlt('Alt text', {
      multiline: true,
      help: 'Describe the image for screen readers and SEO'
    }),
    width: hidden<number>('Image width'),
    height: hidden<number>('Image height'),
    preview: hidden<string>('Preview'),
    averageColor: hidden<string>('Average color'),
    focus: hidden<{x: number; y: number}>('Focus'),
    thumbHash: hidden<string>('Blur hash')
  }
})

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
    builtins: {type: false, status: false},
    // Entry ids start with their creation time, so the newest files come
    // first, below the folders
    sort: [{asc: foldersFirst}, {desc: Entry.id}],
    sorts: {
      latest: {
        label: 'Latest',
        by: [foldersFirst, Entry.id],
        direction: 'desc'
      },
      title: {label: 'Title', by: Entry.title},
      size: {label: 'Size', by: MediaFile.size, direction: 'desc'},
      dimensions: {
        label: 'Dimensions',
        by: [MediaFile.width, MediaFile.height],
        direction: 'desc'
      },
      fileType: {label: 'File type', by: [MediaFile.extension, Entry.title]}
    },
    filters: {
      show: {
        label: 'Show',
        options: {
          files: {label: 'Files', filter: {_type: 'MediaFile'}},
          folders: {label: 'Folders', filter: {_type: 'MediaLibrary'}}
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
          preview: MediaFile.preview,
          averageColor: MediaFile.averageColor,
          extension: MediaFile.extension
        },
        view: viewKeys.MediaPreviewCell
      }),
      dimensions: column({
        header: 'Dimensions',
        position: 'start',
        width: 150,
        select: {width: MediaFile.width, height: MediaFile.height},
        sortBy: MediaFile.width,
        format: ({width, height}) =>
          width && height ? `${width} × ${height} px` : ''
      }),
      size: column({
        header: 'Size',
        position: 'start',
        width: 110,
        align: 'end',
        select: MediaFile.size,
        format: size =>
          typeof size === 'number' && Number.isFinite(size) && size >= 0
            ? prettyBytes(size)
            : ''
      }),
      fileType: column({
        header: 'File type',
        position: 'start',
        width: 110,
        select: MediaFile.extension,
        format: extension =>
          extension ? extension.replace(/^\./, '').toUpperCase() : ''
      })
    }
  }
}
