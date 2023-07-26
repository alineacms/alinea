import {Listbox} from '@headlessui/react'
import {useNavigate} from 'alinea/dashboard/util/HashRouter'
import {HStack, Icon, fromModule} from 'alinea/ui'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useLocale} from '../../hook/UseLocale.js'
import {useNav} from '../../hook/UseNav.js'
import {useRoot} from '../../hook/UseRoot.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './LangSwitch.module.scss'

const styles = fromModule(css)

export function Langswitch() {
  const navigate = useNavigate()
  const nav = useNav()
  const root = useRoot()
  const currentLocale = useLocale()
  const {name: workspace} = useWorkspace()
  return (
    <div className={styles.langswitch()}>
      <Listbox
        value={currentLocale}
        onChange={value => {
          if (!value) return
          // const translation = draft?.translation(value)
          navigate(
            nav.entry({
              // id: translation?.id || draft?.versionId,
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
              {currentLocale}
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
                      {locale.toUpperCase()}
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
