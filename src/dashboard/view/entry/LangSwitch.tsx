import {HStack, Icon, fromModule} from 'alinea/ui'
import {IcRoundLanguage} from 'alinea/ui/icons/IcRoundLanguage'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select
} from 'react-aria-components'
import css from './LangSwitch.module.scss'

const styles = fromModule(css)

export interface LangswitchProps {
  locales: Array<string>
  selected: string
  onChange: (locale: string) => void
  inline?: boolean
}

export function Langswitch({
  locales,
  selected,
  onChange,
  inline
}: LangswitchProps) {
  if (locales.length === 0) return null
  return (
    <div className={styles.langswitch({inline})}>
      <Select
        aria-label="Language"
        selectedKey={selected}
        onSelectionChange={value => {
          onChange(value as string)
        }}
      >
        <div>
          <Button
            className={styles.langswitch.input({active: locales.length > 0})}
          >
            <Icon
              icon={IcRoundLanguage}
              className={styles.langswitch.input.icon({lang: true})}
            />
            <span className={styles.langswitch.input.label()}>
              {selected.toUpperCase()}
            </span>
            {locales.length > 0 && (
              <Icon
                icon={IcRoundUnfoldMore}
                className={styles.langswitch.input.icon()}
              />
            )}
          </Button>
          {locales.length > 0 && (
            <Popover
              isNonModal
              placement="bottom right"
              className={styles.langswitch.dropdown()}
            >
              <ListBox className={styles.langswitch.dropdown.inner()}>
                {locales.map(locale => (
                  <ListBoxItem
                    key={locale}
                    id={locale}
                    textValue={locale.toUpperCase()}
                    className={styles.langswitch.dropdown.option()}
                  >
                    <HStack center gap={4}>
                      {locale.toUpperCase()}
                    </HStack>
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          )}
        </div>
      </Select>
    </div>
  )
}
