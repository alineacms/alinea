import {useState} from 'react'
import {Stack} from '../stories/Stack.tsx'
import {Button} from './Button.tsx'
import {ComboBox, ComboBoxItem} from './ComboBox.tsx'
import {TextField} from './TextField.tsx'

export const Basic = () => {
  const softwareOptions = [
    {id: 1, name: 'Adobe Photoshop'},
    {id: 2, name: 'Adobe XD'},
    {id: 3, name: 'Figma'},
    {id: 4, name: 'InVision'},
    {id: 5, name: 'Sketch'}
  ]

  const largeOptions = Array.from({length: 1000}, (_, i) => ({
    id: i + 1,
    name: `Option ${i + 1}`
  }))

  const longTextOptions = [
    {
      id: 1,
      name: 'The only thing standing between me and greatness is this ridiculously long dropdown option.'
    },
    {
      id: 2,
      name: 'Legend has it, those who select this option gain +10 charisma but lose the ability to speak in short sentences.'
    },
    {
      id: 3,
      name: "If you're reading this, congratulations! You've found the secret to happiness hidden in a dropdown menu."
    },
    {
      id: 4,
      name: 'Warning: Selecting this option may result in spontaneous bouts of joy and uncontrollable laughter.'
    }
  ]

  return (
    <Stack align="normal">
      <ComboBox items={softwareOptions} label="Design software">
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>

      <ComboBox
        items={softwareOptions}
        label="Design software"
        defaultSelectedKey={3}
      >
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>

      <ComboBox items={softwareOptions} label="ComboBox: isDisabled" isDisabled>
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>

      <ComboBox
        items={softwareOptions}
        label="ComboBoxItem: isDisabled"
        disabledKeys={[2, 4]}
      >
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>

      <form onSubmit={e => e.preventDefault()}>
        <Stack gap={8}>
          <ComboBox
            isRequired
            items={softwareOptions}
            label="Design software"
            description="Validation on submit"
            errorMessage="Please select an item in the list."
          >
            {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
          </ComboBox>
          <Button type="submit">Submit</Button>
        </Stack>
      </form>

      <ComboBox label="Large option list" items={largeOptions}>
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>

      <ComboBox label="Funny long text options" items={longTextOptions}>
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>
    </Stack>
  )
}

export const Dynamic = () => {
  const [options, setOptions] = useState([
    {id: 1, name: 'Aerospace'},
    {id: 2, name: 'Mechanical'},
    {id: 3, name: 'Civil'},
    {id: 4, name: 'Biomedical'},
    {id: 5, name: 'Nuclear'},
    {id: 6, name: 'Industrial'},
    {id: 7, name: 'Chemical'},
    {id: 8, name: 'Agricultural'},
    {id: 9, name: 'Electrical'}
  ])
  const [newOption, setNewOption] = useState('')

  return (
    <Stack>
      <ComboBox label="Dynamic options" items={options}>
        {item => <ComboBoxItem key={item.id}>{item.name}</ComboBoxItem>}
      </ComboBox>
      <Stack align="end" direction="row">
        <TextField
          label="Add option"
          value={newOption}
          onChange={setNewOption}
        />
        <Button
          onPress={() => {
            setOptions([...options, {id: options.length + 1, name: newOption}])
            setNewOption('')
          }}
          data-size="large"
        >
          Add option
        </Button>
      </Stack>
    </Stack>
  )
}

export default {
  title: 'Components / ComboBox'
}
