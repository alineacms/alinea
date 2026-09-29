'use client'

import {Checkbox, CheckboxGroup} from 'alinea/components'

export function CheckboxGroupExample() {
  return (
    <CheckboxGroup label="Locales" defaultValue={['en', 'nl']}>
      <Checkbox value="en">English</Checkbox>
      <Checkbox value="nl">Nederlands</Checkbox>
      <Checkbox value="fr">Français</Checkbox>
    </CheckboxGroup>
  )
}
