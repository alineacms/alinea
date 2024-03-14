import {FieldOptions, ScalarField, WithoutLabel} from 'alinea/core'
import {InputLabel, useField} from 'alinea/dashboard'
import {HStack, VStack} from 'alinea/ui'
import {SVGProps, useState} from 'react'
import css from './PositionField.module.css'

export interface PositionOptions extends FieldOptions<Position> {}

export interface Position {
  x: number | null
  y: number | null
}

class PositionField extends ScalarField<Position, PositionOptions> {}

export function position(
  label: string,
  options: WithoutLabel<PositionOptions> = {}
) {
  return new PositionField({
    options: {label, ...options},
    hint: undefined!,
    view: PositionInput
  })
}

interface PositionInputProps {
  field: PositionField
}

const displayCoordinate = (value: number | null) => {
  if (value === null) return ''
  return (value * 100).toFixed(2)
}

export function PositionInput({field}: PositionInputProps) {
  const {
    label,
    options,
    value = {x: null, y: null},
    mutator: setValue
  } = useField(field)
  const [hover, setHover] = useState([undefined, undefined] as [
    number?,
    number?
  ])
  const hasValue = value.x !== null && value.y !== null
  return (
    <InputLabel label={label} className={css.field}>
      <HStack gap={20} wrap center>
        <div
          style={{
            position: 'relative',
            width: 300,
            height: 300,
            cursor: 'pointer',
            borderRadius: 'var(--alinea-border-radius)',
            outline: '0.125rem solid var(--alinea-fields-focus)'
          }}
          onMouseMove={event => {
            const rect = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - rect.left) / rect.width
            const y = (event.clientY - rect.top) / rect.height
            setHover([x, y])
          }}
          onMouseOut={() => setHover([undefined, undefined])}
          onClick={event => {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - rect.left) / rect.width
            const y = (event.clientY - rect.top) / rect.height
            setValue({x, y})
          }}
        >
          <IonEarth />
          {hasValue && (
            <div
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                left: displayCoordinate(value.x) + '%',
                top: displayCoordinate(value.y) + '%',
                color: 'yellow',
                transform: 'translate(-50%, -100%)',
                fontSize: 35
              }}
            >
              <IcTwotonePinDrop />
            </div>
          )}
        </div>
        <VStack gap={12}>
          <HStack gap={8} center as="label">
            <b>X</b>
            <input
              style={{textAlign: 'right'}}
              className="alinea-TextInput-input"
              type="number"
              min="0"
              max="100"
              value={displayCoordinate(hover[0] ?? value.x)}
              onChange={event =>
                setValue({...value, x: Number(event.target.value) / 100})
              }
            />
            %
          </HStack>
          <HStack gap={8} center as="label">
            <b>Y</b>
            <input
              style={{textAlign: 'right'}}
              className="alinea-TextInput-input"
              type="number"
              min="0"
              max="100"
              value={displayCoordinate(hover[1] ?? value.y)}
              onChange={event =>
                setValue({...value, y: Number(event.target.value) / 100})
              }
            />
            %
          </HStack>
        </VStack>
      </HStack>
    </InputLabel>
  )
}

export function IonEarth(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" {...props}>
      <path
        fill="currentColor"
        d="M414.39 97.74A224 224 0 1 0 97.61 414.52A224 224 0 1 0 414.39 97.74ZM64 256.13a191.63 191.63 0 0 1 6.7-50.31c7.34 15.8 18 29.45 25.25 45.66c9.37 20.84 34.53 15.06 45.64 33.32c9.86 16.21-.67 36.71 6.71 53.67c5.36 12.31 18 15 26.72 24c8.91 9.08 8.72 21.52 10.08 33.36a305.36 305.36 0 0 0 7.45 41.27c0 .1 0 .21.08.31C117.8 411.13 64 339.8 64 256.13Zm192 192a193.12 193.12 0 0 1-32-2.68c.11-2.71.16-5.24.43-7c2.43-15.9 10.39-31.45 21.13-43.35c10.61-11.74 25.15-19.68 34.11-33c8.78-13 11.41-30.5 7.79-45.69c-5.33-22.44-35.82-29.93-52.26-42.1c-9.45-7-17.86-17.82-30.27-18.7c-5.72-.4-10.51.83-16.18-.63c-5.2-1.35-9.28-4.15-14.82-3.42c-10.35 1.36-16.88 12.42-28 10.92c-10.55-1.41-21.42-13.76-23.82-23.81c-3.08-12.92 7.14-17.11 18.09-18.26c4.57-.48 9.7-1 14.09.68c5.78 2.14 8.51 7.8 13.7 10.66c9.73 5.34 11.7-3.19 10.21-11.83c-2.23-12.94-4.83-18.21 6.71-27.12c8-6.14 14.84-10.58 13.56-21.61c-.76-6.48-4.31-9.41-1-15.86c2.51-4.91 9.4-9.34 13.89-12.27c11.59-7.56 49.65-7 34.1-28.16c-4.57-6.21-13-17.31-21-18.83c-10-1.89-14.44 9.27-21.41 14.19c-7.2 5.09-21.22 10.87-28.43 3c-9.7-10.59 6.43-14.06 10-21.46c1.65-3.45 0-8.24-2.78-12.75q5.41-2.28 11-4.23a15.6 15.6 0 0 0 8 3c6.69.44 13-3.18 18.84 1.38c6.48 5 11.15 11.32 19.75 12.88c8.32 1.51 17.13-3.34 19.19-11.86c1.25-5.18 0-10.65-1.2-16a190.83 190.83 0 0 1 105 32.21c-2-.76-4.39-.67-7.34.7c-6.07 2.82-14.67 10-15.38 17.12c-.81 8.08 11.11 9.22 16.77 9.22c8.5 0 17.11-3.8 14.37-13.62c-1.19-4.26-2.81-8.69-5.42-11.37a193.27 193.27 0 0 1 18 14.14c-.09.09-.18.17-.27.27c-5.76 6-12.45 10.75-16.39 18.05c-2.78 5.14-5.91 7.58-11.54 8.91c-3.1.73-6.64 1-9.24 3.08c-7.24 5.7-3.12 19.4 3.74 23.51c8.67 5.19 21.53 2.75 28.07-4.66c5.11-5.8 8.12-15.87 17.31-15.86a15.4 15.4 0 0 1 10.82 4.41c3.8 3.94 3.05 7.62 3.86 12.54c1.43 8.74 9.14 4 13.83-.41a192.12 192.12 0 0 1 9.24 18.77c-5.16 7.43-9.26 15.53-21.67 6.87c-7.43-5.19-12-12.72-21.33-15.06c-8.15-2-16.5.08-24.55 1.47c-9.15 1.59-20 2.29-26.94 9.22c-6.71 6.68-10.26 15.62-17.4 22.33c-13.81 13-19.64 27.19-10.7 45.57c8.6 17.67 26.59 27.26 46 26c19.07-1.27 38.88-12.33 38.33 15.38c-.2 9.81 1.85 16.6 4.86 25.71c2.79 8.4 2.6 16.54 3.24 25.21a158 158 0 0 0 4.74 30.07A191.75 191.75 0 0 1 256 448.13Z"
      ></path>
    </svg>
  )
}

export function IcTwotonePinDrop() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 16"
      style={{display: 'block'}}
    >
      <path
        fill="white"
        d="M12 3C9.19 3 6 5.11 6 9.13c0 2.68 2 5.49 6 8.44c4-2.95 6-5.77 6-8.44C18 5.11 14.81 3 12 3z"
      ></path>
      <path
        fill="#4E5FE6"
        d="M12 4c1.93 0 5 1.4 5 5.15c0 2.16-1.72 4.67-5 7.32c-3.28-2.65-5-5.17-5-7.32C7 5.4 10.07 4 12 4m0-2C8.73 2 5 4.46 5 9.15c0 3.12 2.33 6.41 7 9.85c4.67-3.44 7-6.73 7-9.85C19 4.46 15.27 2 12 2z"
      ></path>
      <path
        fill="#4E5FE6"
        d="M12 7c-1.1 0-2 .9-2 2s.9 2 2 2s2-.9 2-2s-.9-2-2-2z"
      ></path>
    </svg>
  )
}
