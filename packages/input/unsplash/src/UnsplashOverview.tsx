import {fromModule} from '@alinea/ui'
import React from 'react'
import UnsplashImage, {UnsplashImageProps} from './UnsplashImage'
import css from './UnsplashOverview.module.scss'

const styles = fromModule(css)

const UnsplashOverview: React.FC<{
  images: UnsplashImageProps[]
  showDragIcon?: boolean
  onRemove?: ((id: string) => void) | null
}> = ({images, onRemove, showDragIcon = false}) => {
  if (!images || images.length === 0) return null

  return (
    <div className={styles.unsplashOverview()}>
      <div className={styles.unsplashOverview.grid()}>
        {images.map(image => (
          <UnsplashImage
            key={image.id}
            image={image}
            remove={onRemove ? () => onRemove(image.id) : null}
            showDragIcon={showDragIcon}
          />
        ))}
      </div>
    </div>
  )
}
export default UnsplashOverview
