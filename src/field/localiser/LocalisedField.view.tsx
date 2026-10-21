import {Tabs, TabsContent, TabsList, TabsTrigger} from '#/components.js'
import type {Field} from '#/core/Field.js'
import {createType} from '#/core/Type.js'
import {NodeEditor} from '#/dashboard/app/NodeEditor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {useFieldInfo} from '#/dashboard/contexts.js'
import {useFieldNode, useOptionalEntryAtoms} from '#/dashboard/hooks.js'
import {type LocalisedField} from '#/field/localiser.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValueRaw} from 'jotai'
import {useMemo} from 'react'
import css from './LocalisedField.module.css'
import {localisedFieldTab} from './LocalisedFieldTab.js'

const styles = styler(css)
const noFieldI18n = atom(undefined)

export interface LocalisedFieldViewProps {
  field: LocalisedField<string, unknown, unknown, unknown>
}

export function LocalisedFieldView({field}: LocalisedFieldViewProps) {
  const scope = useOptionalEntryAtoms()
  const fieldI18n = useAtomValueRaw(scope?.entry.fieldI18n ?? noFieldI18n)
  const {inner} = field.localisation
  // A field without locales of its own uses those of the entry's root
  const locales = field.localisation.locales ?? fieldI18n?.locales
  if (!locales) return <LocalisedFieldPlain field={field} inner={inner} />
  return <LocalisedFieldTabs field={field} inner={inner} locales={locales} />
}

interface LocalisedFieldPartProps {
  field: Field
  inner: Field
}

/** In a root without i18n the field holds the plain value of its inner field */
function LocalisedFieldPlain({field, inner}: LocalisedFieldPartProps) {
  const {key, editor} = useFieldInfo(field)
  const type = useMemo(
    () => createType('', {fields: {[key]: inner}}),
    [key, inner]
  )
  return <NodeEditor node={editor.node} type={type} />
}

interface LocalisedFieldTabsProps extends LocalisedFieldPartProps {
  locales: ReadonlyArray<string>
}

function LocalisedFieldTabs({field, inner, locales}: LocalisedFieldTabsProps) {
  const scope = useOptionalEntryAtoms()
  const [selectedLocale, setSelectedLocale] = useAtom(
    localisedFieldTab(
      locales,
      scope?.entry.id ?? null,
      scope?.localeData.requestedLocale ?? null
    )
  )
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
