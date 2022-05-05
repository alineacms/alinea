import {useBlurData} from '@alinea/dashboard/hook/UseBlurData'
import {fromModule, IconButton} from '@alinea/ui'
import IcRoundClose from '@alinea/ui/icons/IcRoundClose'
import IcRoundDragHandle from '@alinea/ui/icons/IcRoundDragHandle'
import React, {useContext} from 'react'
import css from './UnsplashImage.module.scss'
import {UnsplashContext} from './UnsplashInput'
const styles = fromModule(css)

export type UnsplashImageProps = {
  id: string
  created_at: string
  updated_at: string
  width: number
  height: number
  color: string
  blur_hash: string
  downloads: number
  likes: number
  liked_by_user: boolean
  public_domain: boolean
  description: string
  exif: {
    make: string
    model: string
    name: string
    exposure_time: string
    aperture: string
    focal_length: string
    iso: number
  }
  location: {
    city: string
    country: string
    position: {
      latitude: number
      longitude: number
    }
  }
  tags: Array<{title: string}>
  current_user_collections: Array<{
    id: number
    title: string
    published_at: string
    last_collected_at: string
    updated_at: string
    cover_photo: null
    user: null
  }>
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  links: {
    self: string
    html: string
    download: string
    download_location: string
  }
  user: {
    id: string
    updated_at: string
    username: string
    name: string
    portfolio_url: string
    bio: string
    location: string
    total_likes: number
    total_photos: number
    total_collections: number
    links: {
      self: string
      html: string
      photos: string
      likes: string
      portfolio: string
    }
  }
}

const UnsplashImage: React.FC<{
  remove: () => void
  showDragIcon: boolean
  image: UnsplashImageProps
}> = ({remove, showDragIcon, image}) => {
  const unsplashConfig = useContext(UnsplashContext)
  const blurDataURL = useBlurData(image.blur_hash!)

  return (
    <div
      className={styles.unsplashImage()}
      style={{
        backgroundColor: image.color,
        backgroundImage: `url(${blurDataURL})`
      }}
    >
      <div className={styles.unsplashImage.header()}>
        <span>
          {showDragIcon && (
            <IconButton
              icon={IcRoundDragHandle}
              data-drag-handle
              style={{
                cursor: 'grab'
              }}
              filled={true}
            />
          )}
        </span>
        <IconButton icon={IcRoundClose} onClick={remove} filled={true} />
      </div>
      <figure className={styles.unsplashImage.figure()}>
        <img
          className={styles.unsplashImage.figure.image()}
          src={`${image.urls.raw}?q=75&fm=jpg&w=435&fit=max`}
          loading="lazy"
          alt={image.description}
        />
        <figcaption className={styles.unsplashImage.figure.caption()}>
          Photo by{' '}
          <a
            href={`${image.user.links.html}?utm_source=${unsplashConfig.appName}&utm_medium=referral`}
            className={styles.unsplashImage.figure.caption.link()}
            target="_blank"
          >
            {image.user.name}
          </a>
        </figcaption>
      </figure>
    </div>
  )
}
export default UnsplashImage
