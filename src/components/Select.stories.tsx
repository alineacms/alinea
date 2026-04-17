import {useState} from 'react'
import {Stack} from '../stories/Stack.tsx'
import {IcRoundBrightness} from '../stories/icons/IcRoundBrightness.tsx'
import {IcRoundContentCopy} from '../stories/icons/IcRoundContentCopy.tsx'
import {IcRoundHome} from '../stories/icons/IcRoundHome.tsx'
import {IcRoundSearch} from '../stories/icons/IcRoundSearch.tsx'
import {IcRoundSettings} from '../stories/icons/IcRoundSettings.tsx'
import {Button} from './Button.tsx'
import {Icon} from './Icon.tsx'
import {Select, SelectItem} from './Select.tsx'
import {TextField} from './TextField.tsx'

export const Basic = () => {
  const softwareOptions = [
    {id: 1, name: 'Adobe Photoshop'},
    {id: 2, name: 'Adobe XD'},
    {id: 3, name: 'Figma'},
    {id: 4, name: 'InVision'},
    {id: 5, name: 'Sketch'}
  ]

  const iconOptions = [
    {id: 1, icon: IcRoundBrightness, name: 'IcRoundBrightness'},
    {id: 2, icon: IcRoundContentCopy, name: 'IcRoundContentCopy'},
    {id: 3, icon: IcRoundHome, name: 'IcRoundHome'},
    {id: 4, icon: IcRoundSearch, name: 'IcRoundSearch'},
    {id: 5, icon: IcRoundSettings, name: 'IcRoundSettings'}
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
    },
    {
      id: 5,
      name: 'This dropdown option was written by a team of highly trained hamsters running on tiny treadmills.'
    },
    {
      id: 6,
      name: 'Scientists confirm that selecting this option increases your IQ by 15 points (citation needed).'
    },
    {
      id: 7,
      name: "They said it couldn't be done, yet here it is: the longest, most unnecessary dropdown option of all time."
    },
    {
      id: 8,
      name: 'Clicking this will not summon a genie, but it will make your day 0.1% better. Worth a shot, right?'
    },
    {
      id: 9,
      name: 'Fun fact: This option contains more words than the average tweet. Social media, take notes.'
    },
    {
      id: 10,
      name: 'Select this option and experience the sheer joy of knowing you made the best choice in the history of dropdown selections.'
    }
  ]

  return (
    <Stack align="normal">
      <Select items={softwareOptions} label="Design software">
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <Select
        items={softwareOptions}
        label="Design software"
        description="Placeholder"
        placeholder="Select a software"
      >
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <Select
        items={softwareOptions}
        label="Design software"
        description="Initial selected key"
        defaultSelectedKey={3}
      >
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <Select items={iconOptions} label="Select with Icon">
        {item => (
          <SelectItem key={item.id} textValue={item.name}>
            <div
              style={{
                flexGrow: 1,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Icon icon={item.icon} />
              <span
                style={{
                  flexShrink: 1,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                {item.name}
              </span>
            </div>
          </SelectItem>
        )}
      </Select>

      <Select label="Large option list" items={largeOptions}>
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <Select label="Funny long text options" items={longTextOptions}>
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <h3 style={{marginBottom: 0}}>States</h3>

      <Select
        isDisabled
        items={softwareOptions}
        label="Select"
        description="isDisabled"
      >
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <Select
        disabledKeys={[2, 4]}
        items={softwareOptions}
        label="SelectItem"
        description="isDisabled"
      >
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <Select
        isRequired
        isInvalid
        items={softwareOptions}
        label="Design software"
        description="isInvalid"
        errorMessage="Please select an item in the list."
      >
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>

      <form onSubmit={e => e.preventDefault()}>
        <Stack gap={8} align="normal">
          <Select
            isRequired
            items={softwareOptions}
            label="Design software"
            description="Validation on submit"
            errorMessage="Please select an item in the list."
          >
            {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
          </Select>
          <Button type="submit" style={{alignSelf: 'flex-start'}}>
            Submit
          </Button>
        </Stack>
      </form>
    </Stack>
  )
}

export const Details = () => {
  const richTextOptions = [
    {
      id: 1,
      title: '🚀 Aerospace Engineering',
      description:
        'Designing, developing, and testing aircraft, spacecraft, and satellites.'
    },
    {
      id: 2,
      title: '🦾 Robotics & AI',
      description:
        'Creating intelligent machines that assist or replace human activities.'
    },
    {
      id: 3,
      title: '🔬 Biomedical Innovation',
      description:
        'Developing cutting-edge healthcare technology and medical devices.'
    },
    {
      id: 4,
      title: '🌍 Environmental Science',
      description:
        'Protecting the planet by analyzing and solving ecological challenges.'
    },
    {
      id: 5,
      title: '💻 Software Development',
      description:
        'Writing efficient code to build applications, games, and digital tools.'
    },
    {
      id: 6,
      title: '🏗️ Structural Engineering',
      description:
        'Ensuring buildings and bridges can withstand forces of nature.'
    },
    {
      id: 7,
      title: '⚡ Renewable Energy',
      description:
        'Harnessing wind, solar, and hydro power to create sustainable energy solutions.'
    },
    {
      id: 8,
      title: '🔧 Mechanical Design',
      description:
        'Creating and optimizing machines, engines, and industrial systems.'
    },
    {
      id: 9,
      title: '🛠️ Product Design',
      description: 'Bringing innovative physical and digital products to life.'
    },
    {
      id: 10,
      title: '🛰️ Space Exploration',
      description:
        'Pushing the boundaries of humanity beyond Earth’s atmosphere.'
    }
  ]

  return (
    <Stack align="normal">
      <Select label="Rich text options" items={richTextOptions}>
        {item => (
          <SelectItem key={item.id} textValue={item.title}>
            <Stack gap={0}>
              <p style={{margin: 0}}>
                <strong>{item.title}</strong>
              </p>
              <p style={{margin: 0, fontSize: '0.75rem'}}>{item.description}</p>
            </Stack>
          </SelectItem>
        )}
      </Select>
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
      <Select label="Dynamic options" items={options}>
        {item => <SelectItem key={item.id}>{item.name}</SelectItem>}
      </Select>
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
  title: 'Components / Select'
}
