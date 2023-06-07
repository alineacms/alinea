import {Page, renderLabel, view} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {Projection} from 'alinea/core/pages/Projection'
import {
  Chip,
  Ellipsis,
  HStack,
  TextLabel,
  Typo,
  VStack,
  fromModule,
  px
} from 'alinea/ui'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {ReactNode} from 'react'
import css from './FileSummary.module.scss'

const styles = fromModule(css)

function fileSummarySelect() {
  return {
    id: Page.entryId,
    type: Page.type,
    workspace: Page.workspace,
    root: Page.root,
    title: Page.title,
    extension: MediaFile.extension,
    size: MediaFile.size,
    preview: MediaFile.preview,
    averageColor: MediaFile.averageColor,
    parents({parents}) {
      return parents().select(Page.title)
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
                    .map<ReactNode>(title => <>{title}</>)
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
    return (
      <div className={styles.thumb()}>
        <div className={styles.thumb.preview()}>
          {file.preview ? (
            <img src={file.preview} className={styles.thumb.preview.image()} />
          ) : (
            <div className={styles.thumb.preview.icon()}>
              <IcRoundInsertDriveFile style={{fontSize: px(36)}} />
            </div>
          )}
        </div>
        <div className={styles.thumb.footer()}>
          <span className={styles.thumb.footer.title()}>
            {renderLabel(file.title)}
          </span>
          <Chip style={{marginLeft: 'auto'}}>{file.extension}</Chip>
        </div>
      </div>
    )
  }
)
