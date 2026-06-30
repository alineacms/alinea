import {Radio, RadioGroup} from './RadioGroup.js'

export const Example = () => {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
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
    </div>
  )
}

export default {
  title: 'Components / RadioGroup'
}
