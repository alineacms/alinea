import {useInput} from '@alinea/editor'
import {fromModule, HStack, IconButton, Typo} from '@alinea/ui'
import {PropsWithChildren} from 'react'
import {Helmet} from 'react-helmet'
import {MdArrowBack, MdOutlineMoreHoriz} from 'react-icons/md'
import {EntryDraft} from '../../draft/EntryDraft'
import css from './EntryTitle.module.scss'

const styles = fromModule(css)

export function EntryTitle({children}: PropsWithChildren<{}>) {
  const [title] = useInput(EntryDraft.title)
  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <div className={styles.root()}>
        <HStack center gap={18}>
          <IconButton icon={MdArrowBack} />
          <Typo.H1 flat style={{position: 'relative'}}>
            <span>{title}</span>
            {children}
          </Typo.H1>
          <IconButton icon={MdOutlineMoreHoriz} />
        </HStack>
      </div>
    </>
  )
}
