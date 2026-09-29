import {ContentCard, ContentGrid, ContentGridItem} from '#/components.js'
import type {OverviewEntry} from '#/core/Overview.js'
import type {CSSProperties} from 'react'
import {fileKind, fileKindColor, fileKindIcon} from './FileKind.js'
import {MediaPreviewCell} from './MediaPreviewCell.js'

interface ExampleFile {
  id: string
  title: string
  extension: string
  size: string
}

const files: Array<ExampleFile> = [
  ['Annual report', '.pdf', '2.4 MB'],
  ['Press release', '.docx', '48 kB'],
  ['Price list', '.xlsx', '112 kB'],
  ['Product launch', '.pptx', '8.1 MB'],
  ['Brand assets', '.zip', '64 MB'],
  ['Showreel', '.mp4', '120 MB'],
  ['Podcast episode', '.mp3', '38 MB'],
  ['Feed export', '.json', '12 kB'],
  ['Font license', '.otf', '96 kB']
].map(([title, extension, size], index) => ({
  id: `file-${index}`,
  title,
  extension,
  size
}))

function formatExtension(extension: string) {
  return extension.replace(/^\./, '').toUpperCase()
}

/** Files without an image preview, like the media library shows them */
export function Cards() {
  return (
    <ContentGrid aria-label="Files" items={files} style={{padding: 16}}>
      {file => {
        const kind = fileKind(file.extension)
        return (
          <ContentGridItem id={file.id} textValue={file.title}>
            <ContentCard
              variant="media"
              icon={fileKindIcon(kind)}
              color={fileKindColor(kind)}
              title={file.title}
              description={formatExtension(file.extension)}
              details={file.size}
            />
          </ContentGridItem>
        )
      }}
    </ContentGrid>
  )
}

const tableStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: '8px 16px',
  padding: 16,
  maxWidth: 420,
  fontSize: 'var(--alinea-font-size-base)'
}

function entry(file: ExampleFile): OverviewEntry {
  return {
    id: file.id,
    type: 'MediaFile',
    title: file.title,
    path: file.id,
    url: `/${file.id}`,
    status: 'published',
    locale: null,
    workspace: 'main',
    root: 'media',
    parentId: null
  }
}

/** The preview column of the media library table */
export function TableCells() {
  return (
    <div style={tableStyle}>
      {files.map(file => (
        <div key={file.id} style={{display: 'contents'}}>
          <MediaPreviewCell
            value={{extension: file.extension}}
            entry={entry(file)}
            column="preview"
            locale={null}
          />
          <span>{file.title}</span>
          <span>{formatExtension(file.extension)}</span>
        </div>
      ))}
    </div>
  )
}

export default {
  title: 'Dashboard / FileKind'
}
