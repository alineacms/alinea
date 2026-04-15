import styler from '@alinea/styler'
import {useField} from '#/dashboard/editor/UseField.js'
import {InputLabel, LabelHeader} from '#/dashboard/view/InputLabel.js'
import {Chip, HStack, Icon, TextLabel} from '#/ui.js'
import {IcRoundCheck} from '#/ui/icons/IcRoundCheck.js'
import {IcRoundTextFields} from '#/ui/icons/IcRoundTextFields.js'
import {PhGlobe} from '#/ui/icons/PhGlobe.js'
import {useState} from 'react'
import type {CheckField} from './CheckField.js'
import css from './CheckField.module.scss'

const styles = styler(css)

export interface CheckInputProps {
  field: CheckField
}

export function CheckInput({field}: CheckInputProps) {
  const {value, mutator, label, options, error} = useField(field)
  const {description, readOnly} = options
  const [focus, setFocus] = useState(false)
  return (
    <InputLabel
      asLabel
      {...options}
      error={error}
      label={description ? label : undefined}
      focused={focus}
      icon={IcRoundTextFields}
    >
      <HStack
        center
        gap={10}
        style={{position: 'relative', display: 'inline-flex'}}
      >
        <input
          className={styles.root.input()}
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => {
            if (!readOnly) mutator(e.currentTarget.checked)
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          readOnly={readOnly}
        />
        <span className={styles.root.checkmark({disabled: readOnly})}>
          {value && (
            <Icon
              size={20}
              icon={IcRoundCheck}
              className={styles.root.checkmark.icon()}
            />
          )}
        </span>
        <HStack center>
          <TextLabel
            label={description ?? label}
            className={styles.root.label({disabled: readOnly})}
          />
          {!description && (
            <LabelHeader
              label=""
              help={options?.help}
              required={options?.required}
              shared={options?.shared}
            />
          )}
        </HStack>
      </HStack>
    </InputLabel>
  )
}
