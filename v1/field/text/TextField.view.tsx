import styler from '@alinea/styler'
import {useField} from '#/dashboard/editor/UseField.js'
import {InputLabel} from '#/dashboard/view/InputLabel.js'
import {HStack} from '#/ui.js'
import {IcRoundTextFields} from '#/ui/icons/IcRoundTextFields.js'
import {TextareaAutosize} from '#/ui/util/TextareaAutosize.js'
import {useState} from 'react'
import type {TextField} from './TextField.js'
import css from './TextField.module.scss'

const styles = styler(css)

export interface TextInputProps {
  field: TextField
}

export function TextInput({field}: TextInputProps) {
  const {value, mutator, label, options, error} = useField(field)
  const [focus, setFocus] = useState(false)
  const {
    multiline,
    inline,
    iconLeft: IconLeft,
    iconRight: IconRight,
    autoFocus,
    readOnly
  } = options
  const Input = multiline ? TextareaAutosize : 'input'
  const placeholder = options.placeholder || (inline ? label : '')
  const empty = value === ''
  return (
    <InputLabel
      asLabel
      {...options}
      error={error}
      empty={empty}
      focused={focus}
      icon={IcRoundTextFields}
    >
      <HStack center gap={8}>
        {IconLeft && <IconLeft />}
        <Input
          className={styles.root.input({readOnly})}
          type={options.type || 'text'}
          value={value || ''}
          onChange={e => mutator(e.currentTarget.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          readOnly={options.readOnly}
        />
        {IconRight && <IconRight />}
      </HStack>
    </InputLabel>
  )
}
