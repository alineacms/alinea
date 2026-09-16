import {
  Disclosure,
  DisclosureHeader,
  DisclosurePanel,
  TextField
} from '#/components.js'
import type {EditorNode} from '#/dashboard/atoms/editor.js'
import {slugify} from '#/core/util/Slugs.js'
import {SlugField} from '#/field/path/SlugField.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import css from './ListRowBlockSettings.module.css'

const styles = styler(css)

export interface ListRowBlockSettingsProps {
  defaultExpanded?: boolean
  node: EditorNode
  readOnly?: boolean
}

export function ListRowBlockSettings({
  defaultExpanded,
  node,
  readOnly
}: ListRowBlockSettingsProps) {
  const labelValue = useAtomValueRaw(node.field('_label')) as string | undefined
  const anchorValue = useAtomValueRaw(node.field('_anchor')) as
    | string
    | undefined
  const setLabel = useSetAtom(node.field('_label'))
  const setAnchor = useSetAtom(node.field('_anchor'))
  const label = labelValue ?? ''
  const summary = [label.trim(), anchorValue ? `#${anchorValue}` : '']
    .filter(Boolean)
    .join(' · ')

  function updateLabel(nextValue: string) {
    setLabel(nextValue || undefined)
    const shouldSyncAnchor =
      anchorValue === undefined || anchorValue === slugify(label)
    if (shouldSyncAnchor) setAnchor(slugify(nextValue) || undefined)
  }

  function updateAnchor(nextValue: string) {
    setAnchor(slugify(nextValue.replace(/^#+/, '')) || undefined)
  }

  return (
    <Disclosure appearance="block" defaultExpanded={defaultExpanded}>
      <DisclosureHeader chevronPosition="end" summary={summary || undefined}>
        Settings
      </DisclosureHeader>
      <DisclosurePanel>
        <div className={styles.ListRowBlockSettings.fields()}>
          <TextField
            isDisabled={readOnly}
            label="Label"
            onChange={updateLabel}
            value={label}
          />
          <SlugField
            fieldValue={anchorValue}
            isDisabled={readOnly}
            label="Anchor"
            onChange={updateAnchor}
            source={label}
          />
        </div>
      </DisclosurePanel>
    </Disclosure>
  )
}
