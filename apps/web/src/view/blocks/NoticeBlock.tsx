import {fromModule, HStack} from '@alinea/ui'
import {IcOutlineInfo} from '../../icons/IcOutlineInfo'
import {WebText} from '../layout/WebText'
import css from './NoticeBlock.module.scss'
import {NoticeBlockSchema} from './NoticeBlock.schema'

const styles = fromModule(css)

export function NoticeBlock({level, body}: NoticeBlockSchema) {
  return (
    <div className={styles.root(level)}>
      <HStack gap={10}>
        <IcOutlineInfo className={styles.root.icon()} />
        <WebText doc={body} />
      </HStack>
    </div>
  )
}
