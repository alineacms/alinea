import {
  Chip,
  HStack,
  Icon,
  Loader,
  TextLabel,
  VStack,
  fromModule
} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {UploadStatus} from '../../hook/UseUploads.js'
import css from './FileUploadRow.module.scss'

const styles = fromModule(css)

export interface FileUploadRowProps {
  title: string
  extension: string
  size: number
  preview: string
  averageColor: string
  status: UploadStatus
}

export function FileUploadRow(props: FileUploadRowProps) {
  return (
    <HStack center full gap={10} className={styles.root()}>
      <div className={styles.root.preview()}>
        {props.preview ? (
          <img src={props.preview} className={styles.root.preview.image()} />
        ) : (
          <div className={styles.root.preview.icon()}>
            <IcRoundInsertDriveFile />
          </div>
        )}
      </div>
      <VStack>
        <Ellipsis>
          <TextLabel label={props.title} />
        </Ellipsis>
      </VStack>
      <Chip style={{marginLeft: 'auto'}}>{props.extension}</Chip>
      <div className={styles.root.status()}>
        {props.status === UploadStatus.Done ? (
          <Icon icon={IcRoundCheck} />
        ) : (
          <Loader />
        )}
      </div>
    </HStack>
  )
}
