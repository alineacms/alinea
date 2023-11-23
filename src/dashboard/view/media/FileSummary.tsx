import {Entry, renderLabel, view} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {Projection} from 'alinea/core/pages/Projection'
import {Chip, HStack, TextLabel, Typo, VStack, fromModule, px} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {transparentize} from 'color2k'
import prettyBytes from 'pretty-bytes'
import {Fragment, ReactNode} from 'react'
import css from './FileSummary.module.scss'

const styles = fromModule(css)

function fileSummarySelect() {
  return {
    entryId: Entry.entryId,
    i18nId: Entry.i18nId,
    type: Entry.type,
    workspace: Entry.workspace,
    root: Entry.root,
    title: Entry.title,
    extension: MediaFile.extension,
    size: MediaFile.size,
    preview: MediaFile.preview,
    thumbHash: MediaFile.thumbHash,
    averageColor: MediaFile.averageColor,
    focus: MediaFile.focus,
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
        <Chip style={{marginLeft: 'auto'}}>
          {file.extension.slice(1).toUpperCase()}
        </Chip>
      </HStack>
    )
  }
)

export const FileSummaryThumb = view(
  fileSummarySelect,
  function FileSummaryThumb(file: SummaryProps) {
    const ratio = file.width / file.height
    const imageCover = ratio > 1 && ratio < 2
    return (
      <div className={styles.thumb()} title={renderLabel(file.title)}>
        <div
          className={styles.thumb.preview()}
          style={{
            backgroundImage:
              file.averageColor &&
              `linear-gradient(45deg, ${transparentize(
                file.averageColor,
                0.6
              )} 0%, ${transparentize(file.averageColor, 0.8)} 100%)`
          }}
        >
          {file.preview ? (
            <img
              src={file.preview}
              className={styles.thumb.preview.image(/*{cover: imageCover}*/)}
            />
          ) : (
            <div className={styles.thumb.preview.icon()}>
              <IcRoundInsertDriveFile style={{fontSize: px(36)}} />
            </div>
          )}
        </div>
        <div className={styles.thumb.footer()}>
          <p className={styles.thumb.footer.title()}>
            {renderLabel(file.title)}
          </p>
          <p className={styles.thumb.footer.details()}>
            {file.extension.slice(1).toUpperCase()}
            {file.width && file.height && ` - ${file.width}x${file.height}`}
            <span style={{marginLeft: 'auto'}}>{prettyBytes(file.size)}</span>
          </p>
        </div>
      </div>
    )
  }
)
