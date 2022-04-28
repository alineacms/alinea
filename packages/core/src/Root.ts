import type {ComponentType} from 'react'
import {Label} from './Label'

export class Root<T = string> {
  label: Label

  constructor(
    public name: string,
    public workspace: string,
    private config: RootConfig<T>
  ) {
    this.label = config.label
  }

  get contains() {
    return this.config.contains
  }

  get icon() {
    return this.config.icon
  }

  get i18n() {
    return this.config.i18n
  }
}

export type RootOptions<T = string> = {
  contains: Array<T>
  icon?: ComponentType
  i18n?: {
    locales: Array<string>
  }
}

export type RootConfig<T = string> = {label: Label} & RootOptions<T>

export function root<T>(label: Label, options: RootOptions<T>): RootConfig<T> {
  return {label, ...options}
}
