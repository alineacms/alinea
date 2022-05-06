import {InputLabel} from '@alinea/editor/'
import {
  Button,
  Card,
  fromModule,
  HStack,
  IconButton,
  Loader,
  px,
  Stack,
  Typo
} from '@alinea/ui'
import IcRoundArrowBack from '@alinea/ui/icons/IcRoundArrowBack'
import IcRoundFilterAlt from '@alinea/ui/icons/IcRoundFilterAlt'
import IcRoundSearch from '@alinea/ui/icons/IcRoundSearch'
import {Modal} from '@alinea/ui/Modal'
import Select from '@alinea/ui/Select'
import React, {useContext, useState} from 'react'
import {UnsplashProperties} from './UnsplashField'
import {UnsplashImageProps} from './UnsplashImage'
import {UnsplashContext} from './UnsplashInput'
import UnsplashOverview from './UnsplashOverview'
import {
  colors,
  Colors,
  contentFilters,
  ContentFilters,
  orderBys,
  OrderBys,
  orientations,
  Orientations
} from './UnsplashParams'
import css from './UnsplashSearchModal.module.scss'

const styles = fromModule(css)

const removeNullableValues = (obj: {[key: string]: any}) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== null))
}

const ColorField: React.FC<{
  searchParams: UnsplashProperties
  setSearchParams: React.Dispatch<React.SetStateAction<UnsplashProperties>>
  optional: boolean
}> = ({optional, searchParams, setSearchParams}) => {
  return (
    <InputLabel label="Color" asLabel={true} optional={optional} width={0.5}>
      <Select
        handleOnChange={(key: string | null) => {
          setSearchParams(
            removeNullableValues({
              ...searchParams,
              color: key as Colors
            })
          )
        }}
        selectedKey={searchParams?.color}
        trigger="Select a color"
        optional={optional}
        options={Object.keys(colors)
          .sort()
          .map(key => {
            return {label: colors[key as Colors], key}
          })}
      />
    </InputLabel>
  )
}

const OrderByField: React.FC<{
  searchParams: UnsplashProperties
  setSearchParams: React.Dispatch<React.SetStateAction<UnsplashProperties>>
  optional: boolean
}> = ({optional, searchParams, setSearchParams}) => {
  return (
    <InputLabel label="Order by" asLabel={true} optional={optional} width={0.5}>
      <Select
        handleOnChange={(key: string | null) => {
          setSearchParams(
            removeNullableValues({
              ...searchParams,
              order_by: key as OrderBys
            })
          )
        }}
        selectedKey={searchParams?.order_by}
        trigger="Select an order"
        optional={optional}
        options={Object.keys(orderBys)
          .sort()
          .map(key => {
            return {label: orderBys[key as OrderBys], key}
          })}
      />
    </InputLabel>
  )
}

const ContentFiltersField: React.FC<{
  searchParams: UnsplashProperties
  setSearchParams: React.Dispatch<React.SetStateAction<UnsplashProperties>>
  optional: boolean
}> = ({optional, searchParams, setSearchParams}) => {
  return (
    <InputLabel
      label="Content filter"
      asLabel={true}
      optional={optional}
      width={0.5}
    >
      <Select
        handleOnChange={(key: string | null) => {
          setSearchParams(
            removeNullableValues({
              ...searchParams,
              content_filter: key as ContentFilters
            })
          )
        }}
        selectedKey={searchParams?.content_filter}
        trigger="Select a content filter"
        optional={optional}
        options={Object.keys(contentFilters)
          .sort()
          .map(key => {
            return {label: contentFilters[key as ContentFilters], key}
          })}
      />
    </InputLabel>
  )
}

const OrientationsField: React.FC<{
  searchParams: UnsplashProperties
  setSearchParams: React.Dispatch<React.SetStateAction<UnsplashProperties>>
  optional: boolean
}> = ({optional, searchParams, setSearchParams}) => {
  return (
    <InputLabel
      label="Orientation"
      asLabel={true}
      optional={optional}
      width={0.5}
    >
      <Select
        handleOnChange={(key: string | null) => {
          setSearchParams(
            removeNullableValues({
              ...searchParams,
              orientation: key as Orientations
            })
          )
        }}
        selectedKey={searchParams?.orientation}
        trigger="Select an orientation"
        optional={optional}
        options={Object.keys(orientations)
          .sort()
          .map(key => {
            return {label: orientations[key as Orientations], key}
          })}
      />
    </InputLabel>
  )
}

const UnsplashSearchModal: React.FC<{
  isOpen: boolean
  handleClose: () => void
  handleAddImages: (images: Array<UnsplashImageProps>) => void
  filters: UnsplashProperties
}> = ({isOpen, handleClose, handleAddImages, filters}) => {
  const unsplashConfig = useContext(UnsplashContext)
  const [filtersVisible, setFiltersVisible] = useState<boolean>(false)
  const [searchParams, setSearchParams] = useState<UnsplashProperties>(filters)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [searchResults, setSearchResults] = useState<Array<UnsplashImageProps>>(
    []
  )
  const [selectedImages, setSelectedImages] = useState<Set<UnsplashImageProps>>(
    new Set()
  )
  const disabled: boolean =
    typeof searchParams.query === 'undefined' ||
    searchParams.query.length === 0 ||
    isSubmitting

  const submitRequest = async () => {
    if (disabled) return null

    setIsSubmitting(true)

    // clean the searchParams by removing all undefines
    const searchQueryParams = {...searchParams}
    Object.keys(searchQueryParams).forEach(key =>
      (searchQueryParams as any)[key] === undefined
        ? delete (searchQueryParams as any)[key]
        : {}
    )

    const searchQuery = new URLSearchParams(
      removeNullableValues(searchQueryParams) as Record<string, string>
    )

    const res = await fetch(
      `https://api.unsplash.com/search/photos?${searchQuery.toString()}`,
      {
        headers: {
          'Accept-Version': 'v1',
          Authorization: `Client-ID ${unsplashConfig.accessKey}`
        }
      }
    )
      .then(res => res.json())
      .then(data => {
        if (data.total && data.total_pages && data.results) {
          setSearchResults(data.results)
        }
      })

    setIsSubmitting(false)
    return
  }

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      style={{content: {minWidth: '826px'}}}
    >
      <HStack center gap={18} className={styles.unsplashSearchModal.header()}>
        <IconButton icon={IcRoundArrowBack} onClick={handleClose} />
        <Typo.H1 flat>Unsplash</Typo.H1>
      </HStack>

      <form
        onSubmit={async e => {
          await submitRequest()
          return false
        }}
      >
        <label className={styles.unsplashSearchModal.label()}>
          <IcRoundSearch className={styles.unsplashSearchModal.label.icon()} />
          <input
            autoFocus
            placeholder="Search"
            value={searchParams.query}
            onChange={event =>
              setSearchParams({...searchParams, query: event.target.value})
            }
            className={styles.unsplashSearchModal.label.input()}
          />
          <Stack.Right>
            <HStack gap={16}>
              <Button
                disabled={disabled}
                onClick={async e => {
                  e.preventDefault()
                  await submitRequest()
                  return false
                }}
              >
                Search
              </Button>
              <IconButton
                icon={IcRoundFilterAlt}
                active={filtersVisible}
                onClick={e => {
                  e.preventDefault()
                  setFiltersVisible(!filtersVisible)
                  return false
                }}
              />
            </HStack>
          </Stack.Right>
        </label>
      </form>

      {filtersVisible && (
        <div className={styles.unsplashSearchModal.optionalFieldsContainer()}>
          <Card.Root>
            <Card.Header>
              <Card.Title>Optional filter settings</Card.Title>
            </Card.Header>
            <Card.Content>
              <ColorField
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                optional={true}
              />
              <OrderByField
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                optional={true}
              />
              <ContentFiltersField
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                optional={true}
              />
              <OrientationsField
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                optional={true}
              />
            </Card.Content>
          </Card.Root>
        </div>
      )}

      <div className={styles.unsplashSearchModal.results()}>
        {isSubmitting && (
          <HStack
            gap={16}
            style={{flexGrow: 1, padding: `${px(16)} 0`, minHeight: 0}}
          >
            <Loader />
          </HStack>
        )}

        {!isSubmitting && (
          <div className={styles.unsplashSearchModal.results.overview()}>
            <UnsplashOverview
              images={searchResults}
              onSelect={(image: UnsplashImageProps) =>
                setSelectedImages(selectedImages.add(image))
              }
            />
            {/* Results here
              {JSON.stringify(searchResults)} */}
          </div>
        )}

        {!isSubmitting && (
          <HStack as="footer">
            <Stack.Right>
              <Button
                disabled={disabled}
                onClick={() => {
                  handleAddImages([...selectedImages])
                  setSelectedImages(new Set())
                  handleClose()
                }}
              >
                Confirm
              </Button>
            </Stack.Right>
          </HStack>
        )}
      </div>
    </Modal>
  )
}

export default UnsplashSearchModal
