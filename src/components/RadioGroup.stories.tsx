import {Stack} from '../stories/Stack.tsx'
import {Radio, RadioGroup} from './RadioGroup.tsx'

export const Example = () => {
  return (
    <Stack>
      <RadioGroup label="Favorite sport">
        <Radio value="soccer">Soccer</Radio>
        <Radio value="baseball">Baseball</Radio>
        <Radio value="basketball">Basketball</Radio>
      </RadioGroup>

      <RadioGroup
        label="Favorite juice"
        isDisabled
        description="What is your favorite juice?"
      >
        <Radio value="apple">Apple</Radio>
        <Radio value="orange">Orange</Radio>
        <Radio value="grape">Grape</Radio>
      </RadioGroup>
    </Stack>
  )
}

export default {
  title: 'Components / RadioGroup'
}
