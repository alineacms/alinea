import {I18nProvider} from 'react-aria-components'
import {DateField} from './DateField.js'

export const Example = () => {
  return (
    <I18nProvider locale="en-UK">
      <div style={{display: 'flex', flexDirection: 'column', gap: 32}}>
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
      </div>
    </I18nProvider>
  )
}

export default {
  title: 'Components / DateField'
}
