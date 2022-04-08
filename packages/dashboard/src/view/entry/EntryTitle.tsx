import {useInput} from '@alineacms/editor'
import {
  Chip,
  fromModule,
  HStack,
  IconButton,
  IconLink,
  Typo
} from '@alineacms/ui'
import {PropsWithChildren} from 'react'
import {Helmet} from 'react-helmet'
import {MdArrowBack, MdOutlineMoreHoriz} from 'react-icons/md'
import {EntryDraft} from '../../draft/EntryDraft'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import css from './EntryTitle.module.scss'

const styles = fromModule(css)

export type EntryTitleProps = PropsWithChildren<{
  backLink?: string
}>

export function EntryTitle({children, backLink}: EntryTitleProps) {
  const draft = useCurrentDraft()
  const [title] = useInput(EntryDraft.title)
  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className={styles.root()}>
        <HStack center gap={18}>
          {backLink && <IconLink icon={MdArrowBack} to={backLink} />}
          <Typo.H1 flat style={{position: 'relative'}}>
            <span>{title}</span>
            {children}
          </Typo.H1>
          <Chip>{draft.channel.label}</Chip>
          <IconButton icon={MdOutlineMoreHoriz} />
        </HStack>
      </div>
    </>
  )
}
