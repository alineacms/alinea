import {Field} from 'alinea/core'
import {useField} from 'alinea/dashboard/editor/UseField'
import {InputLabel} from 'alinea/dashboard/view/InputLabel'
import {HStack, Icon, TextLabel, fromModule} from 'alinea/ui'
import {IcRoundCheck} from 'alinea/ui/icons/IcRoundCheck'
import {IcRoundTextFields} from 'alinea/ui/icons/IcRoundTextFields'
import {useState} from 'react'
import {CheckField, check as createCheck} from './CheckField.js'
import css from './CheckField.module.scss'

export * from './CheckField.js'

export const check = Field.provideView(CheckInput, createCheck)

const styles = fromModule(css)

interface CheckInputProps {
  field: CheckField
}

function CheckInput({field}: CheckInputProps) {
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
          autoFocus={options.autoFocus}
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
        <TextLabel
          label={description ?? label}
          className={styles.root.label({disabled: readOnly})}
        />
      </HStack>
    </InputLabel>
  )
}
