import type {fileSummarySelect} from 'alinea/core/media/MediaTypes.browser'
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

type SummaryProps = Projection.Infer<ReturnType<typeof fileSummarySelect>>

export function FileSummaryRow(file: SummaryProps) {
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
      {file.extension && (
        <Chip style={{marginLeft: 'auto'}}>
          {file.extension.slice(1).toUpperCase()}
        </Chip>
      )}
    </HStack>
  )
}

export function FileSummaryThumb(file: SummaryProps) {
  return (
    <div className={styles.thumb()} title={file.title}>
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
        <p className={styles.thumb.footer.title()}>{file.title}</p>
        <p className={styles.thumb.footer.details()}>
          {file.extension?.slice(1).toUpperCase()}
          {file.width && file.height && ` - ${file.width}x${file.height}`}
          {file.size && (
            <span style={{marginLeft: 'auto'}}>{prettyBytes(file.size)}</span>
          )}
        </p>
      </div>
    </div>
  )
}
