import {useBlurData} from '@alinea/dashboard/hook/UseBlurData'
import {fromModule, IconButton} from '@alinea/ui'
import IcRoundClose from '@alinea/ui/icons/IcRoundClose'
import IcRoundDragHandle from '@alinea/ui/icons/IcRoundDragHandle'
import React, {useContext} from 'react'
import css from './UnsplashImage.module.scss'
import {UnsplashContext} from './UnsplashInput'
const styles = fromModule(css)

type User = {
  id: string
  updated_at: string
  username: string
  name: string
  first_name: string | null
  last_name: string | null
  twitter_username: string | null
  portfolio_url: string | null
  bio: string | null
  location: string | null
  total_collections: number
  total_likes: number
  total_photos: number
  accepted_tos: boolean
  for_hire: boolean
  social: {
    instagram_username: string | null
    portfolio_url: string | null
    twitter_username: string | null
    paypal_email: string | null
  }
  links: {
    self: string
    html: string
    photos: string
    likes: string
    portfolio: string
    following: string
    followers: string
  }
  profile_image: {
    small: string
    medium: string
    large: string
  }
  instagram_username: string | null
}

type LandingPageTag = {
  type: 'landing_page'
  title: string
  source: {
    ancestry: {
      type: {
        slug: string
        pretty_slug: string
      }
      category: {
        slug: string
        pretty_slug: string
      }
      subcategory?: {
        slug: string
        pretty_slug: string
      }
    }
    title: string
    subtitle: string
    description: string | null
    meta_title: string
    meta_description: string
    cover_photo: {
      id: string
      created_at: string
      updated_at: string
      promoted_at: string | null
      width: number
      height: number
      color: string
      blur_hash: string
      description: string | null
      alt_description: string | null
      urls: {
        raw: string
        full: string
        regular: string
        small: string
        thumb: string
        small_s3: string
      }
      links: {
        self: string
        html: string
        download: string
        download_location: string
      }
      categories: Array<any>
      likes: number
      liked_by_user: boolean
      current_user_collections: Array<any>
      sponsorship: null
      topic_submissions: TopicSubmissions
      user: User
    }
  }
}

type SearchTag = {
  type: 'search'
  title: string
}

type TopicSubmissions = {
  [key: string]:
    | {
        status: 'approved'
        approved_on: string
      }
    | {status: 'rejected'}
}

export type UnsplashImageProps = {
  id: string
  created_at: string
  updated_at: string
  promoted_at: string | null
  width: number
  height: number
  color: string
  blur_hash: string
  downloads?: number
  likes: number
  liked_by_user: boolean
  public_domain?: boolean
  description: string | null
  alt_description: string | null
  exif?: {
    make: string
    model: string
    name: string
    exposure_time: string
    aperture: string
    focal_length: string
    iso: number
  }
  location?: {
    city: string
    country: string
    position: {
      latitude: number
      longitude: number
    }
  }
  tags: Array<LandingPageTag | SearchTag>
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
    small_s3?: string
  }
  links: {
    self: string
    html: string
    download: string
    download_location: string
  }
  categories: Array<null>
  sponsorship: null
  topic_submissions: TopicSubmissions
  user: User
}

const UnsplashImage: React.FC<{
  remove?: (() => void) | null
  showDragIcon: boolean
  image: UnsplashImageProps
  onSelect?: (image: UnsplashImageProps) => void
}> = ({remove, showDragIcon, image, onSelect}) => {
  const unsplashConfig = useContext(UnsplashContext)
  const blurDataURL =
    image.blur_hash && image.blur_hash.length === 28
      ? useBlurData(image.blur_hash)
      : null

  return (
    <div
      className={styles.unsplashImage()}
      style={{
        backgroundColor: image.color,
        backgroundImage: blurDataURL ? `url(${blurDataURL})` : 'none'
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
          {onSelect && (
            <input type="checkbox" onClick={() => onSelect(image)} />
          )}
        </span>
        {remove && (
          <IconButton icon={IcRoundClose} onClick={remove} filled={true} />
        )}
      </div>
      <figure className={styles.unsplashImage.figure()}>
        <img
          className={styles.unsplashImage.figure.image()}
          src={`${image.urls.raw}?q=75&fm=jpg&w=435&fit=max`}
          loading="lazy"
          alt={image.description || ''}
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
