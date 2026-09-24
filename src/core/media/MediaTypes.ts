import {IcRoundPermMedia} from '#/dashboard/icons.js'
import {hidden} from '#/field/hidden/HiddenField.js'
import {aliases} from '#/field/metadata/MetadataAliases.js'
import {object} from '#/field/object/ObjectField.js'
import {path} from '#/field/path/PathField.js'
import {text} from '#/field/text/TextField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import prettyBytes from 'pretty-bytes'
import {column, type OverviewOptions} from '../Overview.js'
import {type Type, type} from '../Type.js'
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
    title: text('Title'),
    path: path('Path'),
    metadata: object('Metadata', {
      fields: {
        aliases: aliases()
      }
    }),
    location: hidden<string>('Location'),
    previewUrl: hidden<string>('Preview URL'),
    extension: hidden<string>('Extension'),
    size: hidden<number>('File size'),
    hash: hidden<string>('Hash'),
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
 * The columns of the media library: a preview, the dimensions, size and type
 * of each file
 */
export function mediaOverview(): OverviewOptions {
  return {
    builtins: {type: false, status: false, updated: false, author: false},
    columns: {
      preview: column({
        header: 'Preview',
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
        width: 150,
        select: {width: MediaFile.width, height: MediaFile.height},
        sortBy: MediaFile.width,
        format: ({width, height}) =>
          width && height ? `${width} × ${height} px` : ''
      }),
      size: column({
        header: 'Size',
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
        width: 110,
        select: MediaFile.extension,
        format: extension =>
          extension ? extension.replace(/^\./, '').toUpperCase() : ''
      })
    }
  }
}
