import {Entry, renderLabel, view} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {Projection} from 'alinea/core/pages/Projection'
import {Chip, HStack, TextLabel, Typo, VStack, fromModule, px} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import prettyBytes from 'pretty-bytes'
import {Fragment, ReactNode} from 'react'
import css from './FileSummary.module.scss'

const styles = fromModule(css)

function fileSummarySelect() {
  return {
    entryId: Entry.entryId,
    type: Entry.type,
    workspace: Entry.workspace,
    root: Entry.root,
    title: Entry.title,
    extension: MediaFile.extension,
    size: MediaFile.size,
    preview: MediaFile.preview,
    averageColor: MediaFile.averageColor,
    width: MediaFile.width,
    height: MediaFile.height,
    parents({parents}) {
      return parents(Entry).select({
        entryId: Entry.entryId,
        title: Entry.title
      })
    }
  } satisfies Projection
}

type SummaryProps = Projection.Infer<ReturnType<typeof fileSummarySelect>>

export const FileSummaryRow = view(
  fileSummarySelect,
  function FileSummaryRow(file: SummaryProps) {
    return (
      <HStack center full gap={10} className={styles.row()}>
        <div className={styles.row.preview()}>
          {file.preview ? (
            <img src={file.preview} className={styles.row.preview.image()} />
          ) : (
            <div className={styles.row.preview.icon()}>
              <IcRoundInsertDriveFile />
            </div>
          )}
        </div>
        <VStack>
          {file.parents.length > 0 && (
            <Ellipsis>
              <Typo.Small>
                <HStack center gap={3}>
                  {file.parents
                    .map<ReactNode>(({entryId, title}) => (
                      <Fragment key={entryId}>{title}</Fragment>
                    ))
                    .reduce((prev, curr) => [
                      prev,
                      <IcRoundKeyboardArrowRight />,
                      curr
                    ])}
                </HStack>
              </Typo.Small>
            </Ellipsis>
          )}
          <Ellipsis>
            <TextLabel label={file.title} />
          </Ellipsis>
        </VStack>
        <Chip style={{marginLeft: 'auto'}}>{file.extension}</Chip>
      </HStack>
    )
  }
)

export const FileSummaryThumb = view(
  fileSummarySelect,
  function FileSummaryThumb(file: SummaryProps) {
    const imageCover =
      file.preview && file.width && file.height && file.width > 320

    return (
      <div className={styles.thumb()} title={renderLabel(file.title)}>
        <div className={styles.thumb.preview()}>
          {file.preview ? (
            <img
              src={file.preview}
              className={styles.thumb.preview.image(imageCover && 'cover')}
            />
          ) : (
            <div className={styles.thumb.preview.icon()}>
              <IcRoundInsertDriveFile style={{fontSize: px(36)}} />
            </div>
          )}
          <Chip className={styles.thumb.preview.extension()}>
            {file.extension}
          </Chip>
        </div>
        <div className={styles.thumb.footer()}>
          <p className={styles.thumb.footer.title()}>
            {renderLabel(file.title)}
          </p>
          <p className={styles.thumb.footer.details()}>
            {file.width && file.height && (
              <span>{`${file.width} x ${file.height} px`}</span>
            )}
            {file.size > 0 && file.width && file.height && ' | '}
            {file.size > 0 && <span>{prettyBytes(file.size)}</span>}
          </p>
        </div>
      </div>
    )
  }
)
