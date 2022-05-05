import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, VStack} from '@alinea/ui'
import IcRoundArrowDropDown from '@alinea/ui/icons/IcRoundArrowDropDown'
import IcRoundArrowDropUp from '@alinea/ui/icons/IcRoundArrowDropUp'
import {IcRoundColorLens} from '@alinea/ui/icons/IcRoundColorLens'
import {useState} from 'react'
import {HexColorInput, HexColorPicker} from 'react-colorful'
import {ColorField} from './ColorField'
import css from './ColorInput.module.scss'

const styles = fromModule(css)

type AllowedColorPickerProps = {
  activeColor: string | undefined
  colors: Array<string>
  onClick: (color: string) => void
}

function AllowedColorPicker({
  activeColor,
  colors,
  onClick
}: AllowedColorPickerProps) {
  return (
    <HStack center gap={8}>
      {colors.map(color => (
        <div
          className={styles.root.input.choice({active: color === activeColor})}
          style={{backgroundColor: color}}
          onClick={() => onClick(color)}
        />
      ))}
    </HStack>
  )
}

type AllColorPickerProps = {
  color: string | undefined
  onChange: (color: string) => void
}

function AllColorPicker({color, onChange}: AllColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <VStack gap={8}>
      <HStack
        center
        onClick={() => setShowPicker(!showPicker)}
        className={styles.root.input()}
      >
        <div
          className={styles.root.input.choice()}
          style={{backgroundColor: color}}
        />
        {showPicker ? (
          <IcRoundArrowDropUp className={styles.root.icon()} />
        ) : (
          <IcRoundArrowDropDown className={styles.root.icon()} />
        )}
      </HStack>
      {showPicker && (
        <>
          <HexColorInput
            color={color}
            onChange={onChange}
            className={styles.root.text()}
          />
          <HexColorPicker color={color} onChange={onChange} />
        </>
      )}
    </VStack>
  )
}

export type ColorInputProps = {
  state: InputState<InputState.Scalar<string>>
  field: ColorField
}

export function ColorInput({state, field}: ColorInputProps) {
  const {width, inline, optional, help, initialValue, allowedColors} =
    field.options
  const [value = initialValue, setValue] = useInput(state)

  return (
    <InputLabel
      asLabel
      label={field.label}
      optional={optional}
      inline={inline}
      width={width}
      icon={IcRoundColorLens}
      help={help}
    >
      {allowedColors ? (
        <AllowedColorPicker
          activeColor={value}
          colors={allowedColors}
          onClick={setValue}
        />
      ) : (
        <AllColorPicker color={value} onChange={setValue} />
      )}
    </InputLabel>
  )
}
