import {Media, selectParents, view} from '@alinea/core'
import {Store} from '@alinea/store'
import {Collection} from '@alinea/store/Collection'
import {
  Chip,
  Ellipsis,
  fromModule,
  HStack,
  TextLabel,
  Typo,
  VStack
} from '@alinea/ui'
import {ReactNode} from 'react'
import {MdInsertDriveFile, MdKeyboardArrowRight} from 'react-icons/md'
import css from './FileSummary.module.scss'

const styles = fromModule(css)

function fileSummarySelect(File: Collection<Media.File>) {
  return {
    id: File.id,
    type: File.type,
    workspace: File.workspace,
    root: File.root,
    title: File.title,
    extension: File.extension,
    size: File.size,
    preview: File.preview,
    averageColor: File.averageColor,
    parents: selectParents(File, Parent => ({
      title: Parent.title
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
              <MdInsertDriveFile size={12} />
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
                      <MdKeyboardArrowRight />,
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
              <MdInsertDriveFile size={36} />
            </div>
          )}
        </div>
        <div className={styles.thumb.footer()}>
          <span className={styles.thumb.footer.title()}>{file.title}</span>
          <Chip style={{marginLeft: 'auto'}}>{file.extension}</Chip>
        </div>
      </div>
    )
  }
)
