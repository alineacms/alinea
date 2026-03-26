import {Label} from '@alinea/components'
import styler from '@alinea/styler'
import {RichTextField as CoreRichTextField} from 'alinea/core/field/RichTextField'
import {Schema} from 'alinea/core/Schema'
import {RichTextOptions} from 'alinea/field/richtext/RichTextField'
import {useFieldOptions} from 'alinea/v2/store'
import {memo} from 'react'
import css from './RichTextField.module.css'

const styles = styler(css)

export interface RichTextFieldViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
}

export const RichTextFieldView = memo(function RichTextFieldView<
  Blocks extends Schema
>({field}: RichTextFieldViewProps<Blocks>) {
  const options = useFieldOptions(field)
  return (
    <Label
      description={options.help}
      isRequired={options.required}
      label={options.label}
    >
      here comes text
    </Label>
  )
})
