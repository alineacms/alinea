import {Stack} from '../stories/Stack.tsx'
import {Button} from './Button.tsx'
import {Checkbox} from './Checkbox.tsx'

export const Example = () => (
  <Stack>
    <Checkbox>Checkbox</Checkbox>
    <Checkbox
      label="Label & description"
      description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
    />
    <Checkbox description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque elit lectus, maximus et rutrum eget, lobortis eget nulla. Donec ut quam suscipit, feugiat ipsum eget, blandit risus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Quisque viverra erat elit, sed lobortis mauris pulvinar eu. Interdum et malesuada fames ac ante ipsum primis in faucibus. Integer eu lobortis quam, at porta erat. Pellentesque gravida risus sed ornare finibus. Maecenas quam nisi, semper vitae ullamcorper nec, convallis eu massa. Vivamus porttitor diam in fermentum mollis.">
      Children & description
    </Checkbox>
    <Checkbox defaultSelected>defaultSelected</Checkbox>

    <h3 style={{marginBottom: 0}}>States</h3>

    <Checkbox isInvalid>isInvalid</Checkbox>

    <form onSubmit={e => e.preventDefault()}>
      <Stack align="start" gap={8}>
        <Checkbox isRequired label="isRequired" />
        <Button type="submit">Submit</Button>
      </Stack>
    </form>

    <Checkbox isDisabled label="Disabled" description="isDisabled" />
    <Checkbox
      isSelected
      isDisabled
      label="Disabled & selected"
      description="isDisabled"
    />
    <Checkbox
      isReadOnly
      isSelected
      label="Read-only & selected"
      description="isReadOnly & isSelected"
    />
  </Stack>
)

export default {
  title: 'Components / Checkbox'
}
