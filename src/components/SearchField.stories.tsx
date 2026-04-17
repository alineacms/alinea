import {Button} from './Button.js'
import {SearchField} from './SearchField.js'

export const Example = () => (
  <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
    <SearchField label="Search" />
    <SearchField aria-label="Search" placeholder="Search..." hasIcon />
    <SearchField
      aria-label="Search"
      placeholder="Search..."
      hasIcon
      isPending
    />
    <SearchField label="Search" description="Lorem ipsum dolor sit amet." />

    <h3 style={{marginBottom: 0}}>States</h3>
    <SearchField
      label="Search"
      description="isInvalid"
      isInvalid
      errorMessage="This field is invalid."
    />
    <form onSubmit={e => e.preventDefault()}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        <SearchField
          isRequired
          label="Search"
          description="Validation on submit"
          errorMessage="This field is required."
        />
        <Button type="submit" style={{alignSelf: 'flex-start'}}>
          Submit
        </Button>
      </div>
    </form>
    <SearchField
      isDisabled
      label="Disabled"
      description="isDisabled"
      value="Disabled text"
    />
    <SearchField
      isReadOnly
      label="Read-only"
      description="isReadOnly"
      value="Read-only text"
    />
  </div>
)

export default {
  title: 'Components / SearchField'
}
