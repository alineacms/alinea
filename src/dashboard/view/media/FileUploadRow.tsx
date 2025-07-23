import styler from '@alinea/styler'
import {Chip, HStack, Icon, Loader, TextLabel, VStack} from 'alinea/ui'
import {Ellipsis} from 'alinea/ui/Ellipsis'
import {IcBaselineErrorOutline} from 'alinea/ui/icons/IcBaselineErrorOutline'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {useTranslation} from '../../hook/UseTranslation.js'
import {type Upload, UploadStatus} from '../../hook/UseUploads.js'
import css from './FileUploadRow.module.scss'

const styles = styler(css)

export function FileUploadRow(upload: Upload) {
  const {fileUploadRow: t} = useTranslation()
  return (
    <HStack center full gap={10} className={styles.root()}>
      <div className={styles.root.preview()}>
        {upload.preview ? (
          <img
            alt={t.alt}
            src={upload.preview}
            className={styles.root.preview.image()}
          />
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
          <Icon
            icon={upload.error ? IcBaselineErrorOutline : IcRoundCheck}
            title={upload.error ? upload.error.message : t.done}
          />
        ) : (
          <Loader />
        )}
      </div>
    </HStack>
  )
}
