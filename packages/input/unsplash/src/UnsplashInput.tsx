import {InputLabel, InputState, useInput} from '@alinea/editor'
import {Card, Create, fromModule} from '@alinea/ui'
import {Unsplash} from '@alinea/ui/icons/Unsplash'
import React, {useContext, useState} from 'react'
import {UnsplashField, UnsplashProperties} from './UnsplashField'
import {UnsplashImageProps} from './UnsplashImage'
import css from './UnsplashInput.module.scss'
import UnsplashOverview from './UnsplashOverview'
import UnsplashSearchModal from './UnsplashSearchModal'

const styles = fromModule(css)

export const UnsplashContext = React.createContext({
  appName: 'alinea',
  accessKey: 'N6xhD0Uc2W6s1d-u0OC-1cem30AAtrc-Tk3S51i6ht4'
})

export type UnsplashInputProps = {
  state: InputState<InputState.Scalar<UnsplashImageProps[]>>
  field: UnsplashField
}

export function UnsplashInput({state, field}: UnsplashInputProps) {
  const unsplashConfig = useContext(UnsplashContext)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [value, setValue] = useInput(state)
  // console.log(JSON.stringify(value))
  const {width, inline, optional, help} = field.options
  const unsplashOptions: UnsplashProperties = (({
    query,
    per_page,
    order_by,
    collections,
    content_filter,
    color,
    orientation
  }) => ({
    query,
    per_page,
    order_by,
    collections,
    content_filter,
    color,
    orientation
  }))(field.options)

  const empty: boolean = !value || value.length === 0
  const showAddButton: boolean =
    empty ||
    (field.options.multiple &&
      ((field.options.multiple.maximum &&
        value.length < field.options.multiple.maximum) ||
        !field.options.multiple.maximum)) ||
    false

  function addImages(images: Array<UnsplashImageProps>) {
    // todo: get an image from through the API
    const newImages: Array<UnsplashImageProps> = value
      ? images.filter(item => ![...value].map(v => v.id).includes(item.id))
      : images
    setValue(value ? [...value].concat(newImages) : newImages)
  }

  function handleRemove(id: string) {
    if (!value || value.length === 0) return null
    setValue(value.filter(item => item.id !== id))
  }

  return (
    <InputLabel
      label={field.label}
      help={help}
      optional={optional}
      inline={inline}
      width={width}
      icon={Unsplash}
      empty={empty}
    >
      <UnsplashContext.Provider value={unsplashConfig}>
        <div className={styles.root()}>
          <div className={styles.root.inner()}>
            <Card.Root>
              {value && value.length > 0 && (
                <div className={styles.content()}>
                  <UnsplashOverview images={value} onRemove={handleRemove} />
                </div>
              )}
              {showAddButton && (
                <div className={styles.footer()}>
                  <Create.Root>
                    <Create.Button
                      onClick={() => {
                        setIsModalOpen(true)
                      }}
                    >
                      Add an image
                    </Create.Button>
                  </Create.Root>
                </div>
              )}
            </Card.Root>
          </div>
        </div>
        {showAddButton && (
          <UnsplashSearchModal
            isOpen={isModalOpen}
            handleClose={() => setIsModalOpen(false)}
            handleAddImages={addImages}
            filters={unsplashOptions}
          />
        )}
      </UnsplashContext.Provider>
    </InputLabel>
  )
}
