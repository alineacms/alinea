import {Field, Label, Value} from '@alinea/core'
import {UnsplashImageProps} from './UnsplashImage'
import {Colors, ContentFilters, OrderBys, Orientations} from './UnsplashParams'

export type UnsplashProperties = {
  /** Search terms */
  query?: string
  /** Number of items per page */
  per_page?: number
  /** How to sort the photos */
  order_by?: OrderBys
  /** Collection ID(‘s) to narrow search */
  collections?: number | Array<number>
  /** Limit results by content safety (https://unsplash.com/documentation#content-safety) */
  content_filter?: ContentFilters
  /** Filter results by color */
  color?: Colors
  /** Filter by photo orientation */
  orientation?: Orientations
}

/** Optional settings to configure an unsplash field */
export type UnsplashOptions = {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean

  /** Can select multiple unsplash images */
  multiple?: {
    minimum: number
    maximum?: number
  }
} & UnsplashProperties

/** Internal representation of an unsplash field */
export interface UnsplashField extends Field.Scalar<Array<UnsplashImageProps>> {
  label: Label
  options: UnsplashOptions
}

/** Create an unsplash field configuration */
export function createUnsplash(
  label: Label,
  options: UnsplashOptions = {}
): UnsplashField {
  return {
    type: Value.Scalar,
    label,
    options
  }
}
