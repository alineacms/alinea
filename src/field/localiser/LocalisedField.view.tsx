import {Tabs, TabsContent, TabsList, TabsTrigger} from '#/components.js'
import {createType} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/EntryFields.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {useFieldNode} from '#/dashboard/hooks.js'
import {type LocalisedField} from '#/field/localiser.js'
import styler from '@alinea/styler'
import {atom, useAtom} from 'jotai'
import {atomFamily} from 'jotai-family'
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
      value={selectedLocale}
      onValueChange={setSelectedLocale}
      className={styles.LocalisedFieldView()}
    >
      <TabsList>
        {locales.map(locale => {
          return (
            <TabsTrigger value={locale} key={locale}>
              {locale.toUpperCase()}
            </TabsTrigger>
          )
        })}
      </TabsList>
      {locales.map((locale, index) => {
        return (
          <TabsContent value={locale} key={locale}>
            <NodeEditor node={node} type={types[index]} />
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
