import {fromModule} from '@alinea/ui'
import React from 'react'
import UnsplashImage, {UnsplashImageProps} from './UnsplashImage'
import css from './UnsplashOverview.module.scss'

const styles = fromModule(css)

const UnsplashOverview: React.FC<{
  images: UnsplashImageProps[]
  onRemove: (id: string) => void
}> = ({images, onRemove}) => {
  if (!images || images.length === 0) return null
  const showDragIcon: boolean = images.length > 1

  return (
    <div className={styles.unsplashOverview()}>
      <div className={styles.unsplashOverview.grid()}>
        {images.map(image => (
          <UnsplashImage
            key={image.id}
            image={image}
            remove={() => onRemove(image.id)}
            showDragIcon={false && showDragIcon} // todo: remove false => showDragIcon={showDragIcon}
          />
        ))}
      </div>
    </div>
  )
}
export default UnsplashOverview
