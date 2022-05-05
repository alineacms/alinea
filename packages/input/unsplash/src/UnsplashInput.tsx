import {InputLabel, InputState, useInput} from '@alinea/editor'
import {Card, Create, fromModule} from '@alinea/ui'
import {Unsplash} from '@alinea/ui/icons/Unsplash'
import React, {useContext} from 'react'
import {UnsplashField} from './UnsplashField'
import {UnsplashImageProps} from './UnsplashImage'
import css from './UnsplashInput.module.scss'
import UnsplashOverview from './UnsplashOverview'

const styles = fromModule(css)

const data: Array<UnsplashImageProps> = [
  {
    id: 'Dwu85P9SOIk',
    created_at: '2016-05-03T11:00:28-04:00',
    updated_at: '2016-07-10T11:00:01-05:00',
    width: 2448,
    height: 3264,
    color: '#6E633A',
    blur_hash: 'LFC$yHwc8^$yIAS$%M%00KxukYIp',
    downloads: 1345,
    likes: 24,
    liked_by_user: false,
    public_domain: false,
    description: 'A man drinking a coffee.',
    exif: {
      make: 'Canon',
      model: 'Canon EOS 40D',
      name: 'Canon, EOS 40D',
      exposure_time: '0.011111111111111112',
      aperture: '4.970854',
      focal_length: '37',
      iso: 100
    },
    location: {
      city: 'Montreal',
      country: 'Canada',
      position: {
        latitude: 45.473298,
        longitude: -73.638488
      }
    },
    tags: [{title: 'man'}, {title: 'drinking'}, {title: 'coffee'}],
    current_user_collections: [
      {
        id: 206,
        title: 'Makers: Cat and Ben',
        published_at: '2016-01-12T18:16:09-05:00',
        last_collected_at: '2016-06-02T13:10:03-04:00',
        updated_at: '2016-07-10T11:00:01-05:00',
        cover_photo: null,
        user: null
      }
    ],
    urls: {
      raw: 'https://images.unsplash.com/photo-1417325384643-aac51acc9e5d',
      full: 'https://images.unsplash.com/photo-1417325384643-aac51acc9e5d?q=75&fm=jpg',
      regular:
        'https://images.unsplash.com/photo-1417325384643-aac51acc9e5d?q=75&fm=jpg&w=1080&fit=max',
      small:
        'https://images.unsplash.com/photo-1417325384643-aac51acc9e5d?q=75&fm=jpg&w=400&fit=max',
      thumb:
        'https://images.unsplash.com/photo-1417325384643-aac51acc9e5d?q=75&fm=jpg&w=200&fit=max'
    },
    links: {
      self: 'https://api.unsplash.com/photos/Dwu85P9SOIk',
      html: 'https://unsplash.com/photos/Dwu85P9SOIk',
      download: 'https://unsplash.com/photos/Dwu85P9SOIk/download',
      download_location: 'https://api.unsplash.com/photos/Dwu85P9SOIk/download'
    },
    user: {
      id: 'QPxL2MGqfrw',
      updated_at: '2016-07-10T11:00:01-05:00',
      username: 'exampleuser',
      name: 'Joe Example',
      portfolio_url: 'https://example.com/',
      bio: 'Just an everyday Joe',
      location: 'Montreal',
      total_likes: 5,
      total_photos: 10,
      total_collections: 13,
      links: {
        self: 'https://api.unsplash.com/users/exampleuser',
        html: 'https://unsplash.com/exampleuser',
        photos: 'https://api.unsplash.com/users/exampleuser/photos',
        likes: 'https://api.unsplash.com/users/exampleuser/likes',
        portfolio: 'https://api.unsplash.com/users/exampleuser/portfolio'
      }
    }
  }
]

export const UnsplashContext = React.createContext({
  appName: 'alinea'
})

export type UnsplashInputProps = {
  state: InputState<InputState.Scalar<UnsplashImageProps[]>>
  field: UnsplashField
}

export function UnsplashInput({state, field}: UnsplashInputProps) {
  const unsplashConfig = useContext(UnsplashContext)
  const [value, setValue] = useInput(state)
  const {width, inline, optional, help} = field.options
  const empty: boolean = !value || value.length === 0
  const showAddButton: boolean =
    empty ||
    (field.options.multiple &&
      ((field.options.multiple.maximum &&
        value.length < field.options.multiple.maximum) ||
        !field.options.multiple.maximum)) ||
    false

  function handleCreate() {
    // todo: get an image from through the API
    const newImages: Array<UnsplashImageProps> = value
      ? data.filter(item => ![...value].map(v => v.id).includes(item.id))
      : data
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
                    <Create.Button onClick={handleCreate}>
                      Add an image
                    </Create.Button>
                  </Create.Root>
                </div>
              )}
            </Card.Root>
          </div>
        </div>
      </UnsplashContext.Provider>
    </InputLabel>
  )
}
