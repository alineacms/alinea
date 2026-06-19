import {Tab, TabList, TabPanel, Tabs} from '#/components.js'
import {createType} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {ReactiveNode, useFieldNode} from '#/dashboard/store.js'
import {type LocalisedField} from '#/field/localiser.js'
import styler from '@alinea/styler'
import {atom, useAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useMemo} from 'react'
import css from './LocalisedField.module.css'

const styles = styler(css)

export interface LocalisedFieldViewProps {
  field: LocalisedField<string, unknown, unknown, unknown>
}

const localeSelection = atomFamily((locales: ReadonlyArray<string>) => {
  return atom(locales[0])
})

export function LocalisedFieldView({field}: LocalisedFieldViewProps) {
  const {locales, inner} = field.localisation
  const [selectedLocale, setSelectedLocale] = useAtom(localeSelection(locales))
  const node = useFieldNode(field) as ReactiveNode<object>
  const types = useMemo(() => {
    return locales.map(locale =>
      createType(locale, {
        fields: {[locale]: inner}
      })
    )
  }, [locales, inner])
  return (
    <Tabs
      selectedKey={selectedLocale}
      onSelectionChange={key => setSelectedLocale(String(key))}
      className={styles.LocalisedFieldView()}
    >
      <TabList>
        {locales.map(locale => {
          return (
            <Tab id={locale} key={locale}>
              {locale.toUpperCase()}
            </Tab>
          )
        })}
      </TabList>
      {locales.map((locale, index) => {
        return (
          <TabPanel id={locale} key={locale}>
            <NodeEditor node={node} type={types[index]} />
          </TabPanel>
        )
      })}
    </Tabs>
  )
}
