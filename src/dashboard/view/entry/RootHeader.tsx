import {
  Create,
  HStack,
  Icon,
  IconButton,
  TextLabel,
  fromModule
} from 'alinea/ui'
import {link, useNavigate} from 'alinea/ui/util/HashRouter'

import IcRoundKeyboardArrowDown from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import IcRoundKeyboardArrowUp from 'alinea/ui/icons/IcRoundKeyboardArrowUp'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {Listbox} from '@headlessui/react'
import css from './RootHeader.module.scss'
import {useCurrentDraft} from '../../hook/UseCurrentDraft.js'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useState} from 'react'
import {useWorkspace} from '../../hook/UseWorkspace.js'

const styles = fromModule(css)

export type RootHeaderProps = {
  showToggle: boolean
  toggleTree: () => void
  isTreeOpen: boolean
}

export function RootHeader({
  showToggle,
  toggleTree,
  isTreeOpen
}: RootHeaderProps) {
  const nav = useNav()
  const root = useRoot()
  const {name: workspace} = useWorkspace()
  const draft = useCurrentDraft()
  return (
    <div className={styles.root({active: !draft})}>
      <div className={styles.root.inner()}>
        <a
          {...link(nav.root({workspace, root: root.name}))}
          className={styles.root.link()}
        >
          <TextLabel label={root.label} />
        </a>
        {root.i18n && <Langswitch />}
        <Create.Link href={nav.create({workspace, root: root.name})} />
        {showToggle && (
          <IconButton
            icon={
              isTreeOpen ? IcRoundKeyboardArrowUp : IcRoundKeyboardArrowDown
            }
            onClick={toggleTree}
            size={12}
          />
        )}
      </div>
    </div>
  )
}

function Langswitch() {
  const navigate = useNavigate()
  const nav = useNav()
  const root = useRoot()
  const currentLocale = useLocale()!
  const [selectedLang, setSelectedLang] = useState(currentLocale)
  const {name: workspace} = useWorkspace()
  const draft = useCurrentDraft()
  return (
    <div className={styles.langswitch()}>
      <Listbox
        value={selectedLang}
        onChange={value => {
          if (!value) return
          setSelectedLang(value)
          const translation = draft?.translation(value)
          navigate(
            nav.entry({
              id: translation?.id || draft?.id,
              workspace,
              root: root.name,
              locale: value
            })
          )
        }}
      >
        <div>
          <Listbox.Button className={styles.langswitch.input()}>
            <span className={styles.langswitch.input.label()}>
              <TextLabel label={selectedLang} />
            </span>
            <Icon
              icon={IcRoundUnfoldMore}
              className={styles.langswitch.input.icon()}
            />
          </Listbox.Button>
          <Listbox.Options className={styles.langswitch.dropdown()}>
            <div className={styles.langswitch.dropdown.inner()}>
              {root.i18n!.locales.map(locale => (
                <Listbox.Option key={locale} value={locale}>
                  {({active, selected}) => (
                    <HStack
                      center
                      gap={4}
                      className={styles.langswitch.dropdown.option({
                        active,
                        selected
                      })}
                    >
                      <TextLabel label={locale.toUpperCase()} />
                    </HStack>
                  )}
                </Listbox.Option>
              ))}
            </div>
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  )
}
