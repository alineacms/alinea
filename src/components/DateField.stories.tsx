import {I18nProvider} from 'react-aria-components'
import {Stack} from '../stories/Stack.js'
import {DateField} from './DateField.js'

export const Example = () => {
  return (
    <I18nProvider locale="en-UK">
      <Stack gap={32}>
        <DateField label="Default" />
        <DateField
          label="With Description"
          description="Please enter a valid date (dd/mm/yyyy)"
        />
        <DateField
          isRequired
          isInvalid
          label="With Error"
          errorMessage="Date is required"
        />
        <DateField label="Disabled" isDisabled />
      </Stack>
    </I18nProvider>
  )
}

export default {
  title: 'Components / DateField'
}
