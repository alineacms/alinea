import {Listbox} from '@headlessui/react'
import {Create, fromModule, HStack, Icon, TextLabel} from 'alinea/ui'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {link, useNavigate} from 'alinea/ui/util/HashRouter'
import {useState} from 'react'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {useLocale} from '../../hook/UseLocale'
import {useNav} from '../../hook/UseNav'
import {useRoot} from '../../hook/UseRoot'
import {useWorkspace} from '../../hook/UseWorkspace'
import css from './RootHeader.module.scss'

const styles = fromModule(css)

export function RootHeader() {
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
