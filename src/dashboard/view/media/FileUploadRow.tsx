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
import {IcBaselineErrorOutline} from 'alinea/ui/icons/IcBaselineErrorOutline'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {Upload, UploadStatus} from '../../hook/UseUploads.js'
import css from './FileUploadRow.module.scss'

const styles = fromModule(css)

export function FileUploadRow(upload: Upload) {
  return (
    <HStack center full gap={10} className={styles.root()}>
      <div className={styles.root.preview()}>
        {upload.preview ? (
          <img src={upload.preview} className={styles.root.preview.image()} />
        ) : (
          <div className={styles.root.preview.icon()}>
            <IcRoundInsertDriveFile />
          </div>
        )}
      </div>
      <VStack>
        <Ellipsis>
          <TextLabel label={upload.file.name} />
        </Ellipsis>
      </VStack>
      <Chip style={{marginLeft: 'auto'}}>
        {upload.file.name.toLowerCase().split('.').pop()!}
      </Chip>
      <div className={styles.root.status()}>
        {upload.status === UploadStatus.Done ? (
          <Icon icon={upload.error ? IcBaselineErrorOutline : IcRoundCheck} />
        ) : (
          <Loader />
        )}
      </div>
    </HStack>
  )
}
