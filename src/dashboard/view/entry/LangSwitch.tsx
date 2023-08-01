import {Listbox} from '@headlessui/react'
import {HStack, Icon, fromModule} from 'alinea/ui'
import {IcRoundLanguage} from 'alinea/ui/icons/IcRoundLanguage'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import css from './LangSwitch.module.scss'

const styles = fromModule(css)

export interface LangswitchProps {
  locales: Array<string>
  selected: string
  onChange: (locale: string) => void
}

export function Langswitch({selected, locales, onChange}: LangswitchProps) {
  return (
    <div className={styles.langswitch()}>
      <Listbox
        value={selected}
        onChange={value => {
          if (!value) return
          onChange(value)
          /*if (!value) return
          navigate(
            nav.entry({
              entryId: entryLocation?.entryId,
              workspace,
              root: root.name,
              locale: value
            })
          )*/
        }}
      >
        <div>
          <Listbox.Button
            className={styles.langswitch.input({active: locales.length > 0})}
          >
            <Icon
              icon={IcRoundLanguage}
              className={styles.langswitch.input.icon({lang: true})}
            />
            <span className={styles.langswitch.input.label()}>{selected}</span>
            {locales.length > 0 && (
              <Icon
                icon={IcRoundUnfoldMore}
                className={styles.langswitch.input.icon()}
              />
            )}
          </Listbox.Button>
          {locales.length > 0 && (
            <Listbox.Options className={styles.langswitch.dropdown()}>
              <div className={styles.langswitch.dropdown.inner()}>
                {locales.map(locale => (
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
          )}
        </div>
      </Listbox>
    </div>
  )
}
