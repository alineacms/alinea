import {renderLabel} from '@alinea/core/Label'
import {useInput} from '@alinea/editor'
import {Chip, fromModule, HStack, IconLink, Typo} from '@alinea/ui'
import {IcRoundArrowBack} from '@alinea/ui/icons/IcRoundArrowBack'
import {PropsWithChildren} from 'react'
import {EntryDraft} from '../../draft/EntryDraft'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {useWorkspace} from '../../hook/UseWorkspace'
import {Head} from '../../util/Head'
import css from './EntryTitle.module.scss'

const styles = fromModule(css)

export type EntryTitleProps = PropsWithChildren<{
  backLink?: string
}>

export function EntryTitle({children, backLink}: EntryTitleProps) {
  const draft = useCurrentDraft()
  const [title] = useInput(EntryDraft.title)
  const {label} = useWorkspace()
  return (
    <>
      <Head>
        <title>
          {title} - {renderLabel(label)}
        </title>
      </Head>
      <div className={styles.root()}>
        <HStack center gap={18}>
          {backLink && <IconLink icon={IcRoundArrowBack} to={backLink} />}
          <Typo.H1 flat style={{position: 'relative'}}>
            <span>{title}</span>
            {children}
          </Typo.H1>
          <Chip>{renderLabel(draft.channel.label)}</Chip>
          {/*<IconButton icon={MdOutlineMoreHoriz} />*/}
        </HStack>
      </div>
    </>
  )
}
