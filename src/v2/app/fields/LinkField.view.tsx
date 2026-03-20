import {Button, DialogTrigger} from '@alinea/components'
import {styler} from '@alinea/styler'
import {Reference} from 'alinea/core/Reference'
import {LinkField} from 'alinea/field/link/LinkField'
import {LinkPicker} from '../LinkPicker.js'
import css from './LinkField.module.css'

const styles = styler(css)

export interface SingleLinkFieldViewProps {
  field: LinkField<Reference, Reference>
}

export function SingleLinkFieldView({field}: SingleLinkFieldViewProps) {
  return (
    <div>
      pick single link
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker />
      </DialogTrigger>
    </div>
  )
}

export interface MultipleLinksFieldViewProps {
  field: LinkField<Reference, Reference>
}

export function MultipleLinksFieldView({field}: MultipleLinksFieldViewProps) {
  return (
    <div>
      Pick multiple links
      <DialogTrigger>
        <Button>Pick a link</Button>
        <LinkPicker />
      </DialogTrigger>
    </div>
  )
}
