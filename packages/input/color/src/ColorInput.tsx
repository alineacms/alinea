import {InputLabel, InputState, useInput} from '@alinea/editor'
import {fromModule, HStack, IconButton} from '@alinea/ui'
import {useContrastColor} from '@alinea/ui/hook/UseContrastColor'
import {IcRoundCheck} from '@alinea/ui/icons/IcRoundCheck'
import {IcRoundClear} from '@alinea/ui/icons/IcRoundClear'
import {IcRoundColorLens} from '@alinea/ui/icons/IcRoundColorLens'
import {Popover} from '@headlessui/react'
import {HexColorInput, HexColorPicker} from 'react-colorful'
import {ColorField} from './ColorField'
import css from './ColorInput.module.scss'

const styles = fromModule(css)

type AllowedColorPickerProps = {
  selectedColor: string | undefined
  colors: Array<string>
  onClick: (color: string) => void
}

function AllowedColorPicker({
  selectedColor,
  colors,
  onClick
}: AllowedColorPickerProps) {
  const contrastColor = useContrastColor(selectedColor)
  return (
    <>
      <HStack center gap={8}>
        {colors.map(color => (
          <button
            key={color}
            className={styles.root.button()}
            style={{backgroundColor: color}}
            onClick={() => onClick(color)}
          >
            {color === selectedColor && (
              <IcRoundCheck
                className={styles.root.button.check()}
                style={{color: contrastColor}}
              />
            )}
          </button>
        ))}
        {selectedColor && (
          <IconButton icon={IcRoundClear} onClick={() => onClick('')} />
        )}
      </HStack>
    </>
  )
}

type AllColorPickerProps = {
  color: string | undefined
  onChange: (color: string) => void
}

function AllColorPicker({color, onChange}: AllColorPickerProps) {
  return (
    <Popover className={styles.root.popover()}>
      {({open}) => (
        <>
          <Popover.Button className={styles.root.popover.button()}>
            <HStack center>
              <div
                className={styles.root.popover.color({empty: !color})}
                style={{backgroundColor: color}}
              />
              <HexColorInput
                color={color}
                onChange={onChange}
                className={styles.root.popover.input({open: open})}
              />
              {color && (
                <IconButton
                  className={styles.root.popover.clear()}
                  icon={IcRoundClear}
                  onClick={() => onChange('')}
                />
              )}
            </HStack>
          </Popover.Button>
          <Popover.Panel className={styles.root.popover.panel()}>
            <HexColorPicker color={color} onChange={onChange} />
          </Popover.Panel>
        </>
      )}
    </Popover>
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
          selectedColor={value}
          colors={allowedColors}
          onClick={setValue}
        />
      ) : (
        <AllColorPicker color={value} onChange={setValue} />
      )}
    </InputLabel>
  )
}
