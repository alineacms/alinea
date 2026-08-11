import {Button} from './Button.js'
import {TimeField} from './TimeField.js'

export const Example = () => {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <TimeField label="Event time" />

      <form
        onSubmit={e => {
          e.preventDefault()
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          <TimeField
            isRequired
            label="Event time with error"
            errorMessage="time is required"
          />
          <Button type="submit">Submit</Button>
        </div>
      </form>

      <TimeField label="Event time (24h mode)" hourCycle={24} />

      <TimeField
        label="Event time"
        hourCycle={24}
        description="(24h mode) with description"
      />
    </div>
  )
}

export default {
  title: 'Components / TimeField'
}
