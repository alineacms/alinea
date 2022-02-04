import {EntryDraft, useInput} from '@alinea/editor'
import {Typo} from '@alinea/ui'
import {PropsWithChildren} from 'react'
import {Helmet} from 'react-helmet'

export function EntryTitle({children}: PropsWithChildren<{}>) {
  const [title] = useInput(EntryDraft.title)
  return (
    <Typo.H1 style={{position: 'relative', zIndex: 1, paddingBottom: '10px'}}>
      {title} {children}
      <Helmet>
        <title>{title}</title>
      </Helmet>
    </Typo.H1>
  )
}
