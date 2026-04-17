import {useState} from 'react'
import {Stack} from '../stories/Stack.tsx'
import {IcRoundInfo} from '../stories/icons/IcRoundInfo.tsx'
import {Button} from './Button.tsx'
import {Icon} from './Icon.tsx'
import {TextField} from './TextField.tsx'

export const Example = () => {
  const [text, setText] = useState('Multi-line text input, used as textarea.')
  return (
    <Stack align="normal">
      <TextField label="Name" />
      <TextField label="Name (with initial value)" value="Initial name" />
      <TextField
        label="Name (with placeholder)"
        placeholder="Placeholder name"
      />
      <TextField
        multiline
        label="Multiline (with auto size)"
        value={text}
        onChange={setText}
      />
      <TextField
        multiline
        label="Multiline rows={4} (with auto size)"
        value={text}
        onChange={setText}
        rows={4}
      />
      <h3 style={{marginBottom: 0}}>Description</h3>
      <TextField
        label="Short description"
        description="Lorem ipsum dolor sit amet."
        icon={<Icon icon={IcRoundInfo} />}
      />
      <TextField
        label="Long description"
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse ac purus nec mi laoreet tempor. Duis eget lorem facilisis, hendrerit turpis a, congue purus. Mauris pulvinar sapien vestibulum justo sodales, ut cursus magna dictum. In at molestie odio. Donec ut leo vitae nulla euismod facilisis. Quisque pellentesque sodales mi eu lacinia. Suspendisse a nisi volutpat, posuere mauris quis, porttitor nulla. Phasellus quis dapibus diam, accumsan dapibus ipsum."
        icon={<Icon icon={IcRoundInfo} />}
      />

      <h3 style={{marginBottom: 0}}>States</h3>
      <form action={'#'}>
        <Stack align="start" gap={8}>
          <TextField
            isRequired
            label="Username"
            description="isRequired"
            errorMessage="Username already exists"
          />
          <Button type="submit">Submit</Button>
        </Stack>
      </form>
      <TextField
        isDisabled
        label="Disabled"
        description="isDisabled"
        value="Disabled text"
      />
      <TextField
        isReadOnly
        label="Read-only"
        description="isReadOnly"
        value="Read-only text"
      />

      <h3 style={{marginBottom: 0}}>Types</h3>
      <TextField type="email" label="Email" />
      <TextField type="password" label="Password" />
    </Stack>
  )
}

export default {
  title: 'Components / TextField'
}
