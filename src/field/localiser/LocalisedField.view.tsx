import {createType} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/Editor.js'
import {ReactiveNode} from '#/dashboard/atoms/entry/editor.js'
import {useFieldNode} from '#/dashboard/hooks.js'
import {type LocalisedField} from '#/field/localiser.js'
import {atom, useAtom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import {useMemo} from 'react'
import {LocalisedFieldTabs} from './LocalisedFieldTabs.js'

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
    <LocalisedFieldTabs
      locales={locales}
      selectedLocale={selectedLocale}
      onSelectedLocaleChange={setSelectedLocale}
    >
      {locale => (
        <NodeEditor node={node} type={types[locales.indexOf(locale)]} />
      )}
    </LocalisedFieldTabs>
  )
}
