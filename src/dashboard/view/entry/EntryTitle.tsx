import {Type} from 'alinea/core'
import {renderLabel} from 'alinea/core/Label'
import {Chip, fromModule, HStack, IconLink, Typo} from 'alinea/ui'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {useAtomValue} from 'jotai'
import {EntryEditor} from '../../atoms/EntryEditor.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import {Head} from '../../util/Head.js'
import css from './EntryTitle.module.scss'

const styles = fromModule(css)

export interface EntryTitleProps {
  editor: EntryEditor
  backLink?: string
}

export function EntryTitle({editor, backLink}: EntryTitleProps) {
  const {label} = useWorkspace()
  const selectedPhase = useAtomValue(editor.selectedPhase)
  const version = editor.phases[selectedPhase]
  const type = editor.type
  const title = version.title
  return (
    <>
      <Head>
        <title>
          {title} - {renderLabel(label)}
        </title>
      </Head>
      <div className={styles.root()}>
        <HStack center gap={18}>
          {backLink && <IconLink icon={IcRoundArrowBack} href={backLink} />}
          <Typo.H1 flat style={{position: 'relative'}}>
            <span>{title}</span>
          </Typo.H1>
          <Chip>{renderLabel(Type.label(type))}</Chip>
          {/*<IconButton icon={MdOutlineMoreHoriz} />*/}
        </HStack>
      </div>
    </>
  )
}
