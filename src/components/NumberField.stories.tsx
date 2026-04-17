import {I18nProvider} from 'react-aria-components'
import {NumberField} from './NumberField.js'

export const Basic = () => {
  return (
    <I18nProvider locale="en-US">
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <NumberField label="Number of cookies" steppers={false} />
        <NumberField label="Number of cookies (with steppers)" steppers />
        <NumberField label="Number of cookies (disabled)" steppers isDisabled />

        <NumberField
          label="Age"
          minValue={0}
          maxValue={100}
          description="Enter an age between 0 and 100."
        />

        <NumberField label="Temperature" minValue={-50} maxValue={50} />
      </div>
    </I18nProvider>
  )
}

export const Currency = () => {
  return (
    <I18nProvider locale="en-US">
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <NumberField
          label="Transaction amount (€)"
          defaultValue={45}
          formatOptions={{
            style: 'currency',
            currency: 'EUR',
            currencyDisplay: 'symbol'
          }}
        />

        <NumberField
          label="Amount (USD)"
          formatOptions={{
            style: 'currency',
            currency: 'USD',
            currencyDisplay: 'symbol'
          }}
        />

        <NumberField
          label="Cost (GBP)"
          formatOptions={{
            style: 'currency',
            currency: 'GBP',
            currencyDisplay: 'symbol'
          }}
        />
      </div>
    </I18nProvider>
  )
}

export const Percentages = () => {
  return (
    <I18nProvider locale="en-US">
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <NumberField
          label="Discount (%)"
          formatOptions={{
            style: 'percent',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          }}
        />

        <NumberField
          label="Interest rate (%)"
          formatOptions={{
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }}
        />
      </div>
    </I18nProvider>
  )
}

export const Validation = () => {
  return (
    <I18nProvider locale="nl-BE">
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        <NumberField
          isInvalid
          isRequired
          label="Enter a value"
          description="This field is required."
          errorMessage="Field cannot be empty."
        />
      </div>
    </I18nProvider>
  )
}

export default {
  title: 'Components / NumberField'
}
