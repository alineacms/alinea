import {UrlReference} from '../UrlPicker'

export interface UrlPickerRowProps {
  reference: UrlReference
}

export function UrlPickerRow({reference}: UrlPickerRowProps) {
  return (
    <div>
      url: {reference.url}
      desc: {reference.description}
      target: {reference.target}
    </div>
  )
}
