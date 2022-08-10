import {Media, renderLabel, Tree, view} from '@alinea/core'
import {Store} from '@alinea/store'
import {Collection} from '@alinea/store/Collection'
import {
  Chip,
  Ellipsis,
  fromModule,
  HStack,
  px,
  TextLabel,
  Typo,
  VStack
} from '@alinea/ui'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowRight} from '@alinea/ui/icons/IcRoundKeyboardArrowRight'
import {ReactNode} from 'react'
import css from './FileSummary.module.scss'

const styles = fromModule(css)

function fileSummarySelect(File: Collection<Media.File>) {
  return {
    id: File.id,
    type: File.alinea.type,
    workspace: File.alinea.workspace,
    root: File.alinea.root,
    title: File.title,
    extension: File.extension,
    size: File.size,
    preview: File.preview,
    averageColor: File.averageColor,
    parents: Tree.parents(File.id).select(parent => ({
      title: parent.title
    }))
  }
}

type SummaryProps = Store.TypeOf<ReturnType<typeof fileSummarySelect>>

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
                    .map<ReactNode>(({title}) => <TextLabel label={title} />)
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
