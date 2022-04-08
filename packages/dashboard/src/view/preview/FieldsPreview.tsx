import {Entry} from '@alineacms/core/Entry'
import {fromModule, Typo} from '@alineacms/ui'
import {Preview} from '../Preview'
import css from './FieldsPreview.module.scss'

const styles = fromModule(css)

export type FieldsPreviewProps = {
  entry: Entry
}

export function FieldsPreview({entry}: FieldsPreviewProps) {
  return (
    <Preview>
      <div style={{flexGrow: 1, position: 'relative'}}>
        <Typo.Monospace>{JSON.stringify(entry, null, '  ')}</Typo.Monospace>
      </div>
    </Preview>
  )
}
