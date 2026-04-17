import {type HTMLAttributes, type PropsWithChildren, useState} from 'react'
import {Stack} from '../stories/Stack.tsx'
import {IcRoundAccountCircle} from '../stories/icons/IcRoundAccountCircle.tsx'
import {IcRoundArchive} from '../stories/icons/IcRoundArchive.tsx'
import {IcRoundClose} from '../stories/icons/IcRoundClose.tsx'
import {IcRoundHistory} from '../stories/icons/IcRoundHistory.tsx'
import {IcRoundLanguage} from '../stories/icons/IcRoundLanguage.tsx'
import {IcRoundRefresh} from '../stories/icons/IcRoundRefresh.tsx'
import {IcRoundSearch} from '../stories/icons/IcRoundSearch.tsx'
import {IcRoundSettings} from '../stories/icons/IcRoundSettings.tsx'
import {Button} from './Button.tsx'
import {ProgressCircle} from './ProgressCircle.tsx'

const HStack = (props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <Stack {...props} direction="row" wrap="wrap" align="flex-end" />
)

export function All() {
  return (
    <Stack>
      <HStack>
        <Button>Solid</Button>
        <Button isDisabled>Solid disabled</Button>
        <Button appearance="outline">Outline</Button>
        <Button appearance="outline" isDisabled>
          Outline disabled
        </Button>
      </HStack>
      <HStack>
        <Button intent="secondary">Solid secondary</Button>
        <Button appearance="outline" intent="secondary">
          Outline secondary
        </Button>
      </HStack>
      <HStack>
        <Button appearance="plain">Plain</Button>
      </HStack>
    </Stack>
  )
}

export function Appearance() {
  return (
    <Stack>
      <Button>Solid</Button>
      <Button appearance="outline">Outline</Button>
      <Button appearance="plain">Plain</Button>
    </Stack>
  )
}

export function Intents({isDisabled}: {isDisabled: boolean}) {
  return (
    <Stack>
      <HStack>
        <Button>Primary</Button>
        <Button appearance="outline">Primary</Button>
        <Button appearance="plain">Primary</Button>
        <Button isDisabled>Primary</Button>
        <Button appearance="outline" isDisabled>
          Primary
        </Button>
        <Button appearance="plain" isDisabled>
          Primary
        </Button>
      </HStack>
      <HStack>
        <Button intent="secondary">Secondary</Button>
        <Button intent="secondary" appearance="outline">
          Secondary
        </Button>
        <Button intent="secondary" appearance="plain">
          Secondary
        </Button>
        <Button intent="secondary" isDisabled>
          Secondary
        </Button>
        <Button intent="secondary" appearance="outline" isDisabled>
          Secondary
        </Button>
        <Button intent="secondary" appearance="plain" isDisabled>
          Secondary
        </Button>
      </HStack>
      <HStack>
        <Button intent="danger">Danger</Button>
        <Button intent="danger" appearance="outline">
          Danger
        </Button>
        <Button intent="danger" appearance="plain">
          Danger
        </Button>
        <Button intent="danger" isDisabled>
          Danger
        </Button>
        <Button intent="danger" appearance="outline" isDisabled>
          Danger
        </Button>
        <Button intent="danger" appearance="plain" isDisabled>
          Danger
        </Button>
      </HStack>
      <HStack>
        <Button intent="warning">Warning</Button>
        <Button intent="warning" appearance="outline">
          Warning
        </Button>
        <Button intent="warning" appearance="plain">
          Warning
        </Button>
        <Button intent="warning" appearance="plain" isDisabled>
          Warning
        </Button>
        <Button intent="warning" appearance="outline" isDisabled>
          Warning
        </Button>
        <Button intent="warning" appearance="plain" isDisabled>
          Warning
        </Button>
      </HStack>
    </Stack>
  )
}

export function Sizes() {
  return (
    <Stack>
      <HStack>
        <Button size="small">Small</Button>
        <Button>Medium</Button>
        <Button size="large">Large</Button>
      </HStack>
      <div style={{maxWidth: '150px'}}>
        <Button size="large">This is a large button with very long text</Button>
      </div>
    </Stack>
  )
}

export function Icons() {
  const [isLoading, setLoading] = useState<boolean>(false)

  const handlePress = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 4500)
  }

  return (
    <HStack>
      <Button>
        <IcRoundRefresh data-slot="icon" />
        With icon
      </Button>
      <Button size="square-petite">
        <IcRoundRefresh data-slot="icon" />
      </Button>
      <Button size="square-petite" appearance="outline" intent="secondary">
        <IcRoundRefresh data-slot="icon" />
      </Button>
      <Button size="square-petite" appearance="plain" intent="secondary">
        <IcRoundRefresh data-slot="icon" />
      </Button>
      <Button size="square-petite" appearance="plain" intent="secondary">
        <IcRoundRefresh data-slot="icon" />
      </Button>
      <Button isPending={isLoading} icon={IcRoundRefresh} onPress={handlePress}>
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </Button>
      <Button onPress={handlePress}>
        <>
          <ProgressCircle isIndeterminate aria-label="Loading..." />
          Loading...
        </>
      </Button>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 10,
          borderRadius: 6,
          border: '1px solid lightgray'
        }}
      >
        <Button size="square-petite" appearance="active">
          <IcRoundAccountCircle data-slot="icon" />
        </Button>
        <Button size="square-petite" appearance="plain" intent="secondary">
          <IcRoundArchive data-slot="icon" />
        </Button>
        <Button size="square-petite" appearance="plain" intent="secondary">
          <IcRoundHistory data-slot="icon" />
        </Button>
        <Button size="square-petite" appearance="plain" intent="secondary">
          <IcRoundLanguage data-slot="icon" />
        </Button>
        <Button size="square-petite" appearance="plain" intent="secondary">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="square-petite" appearance="plain" intent="secondary">
          <IcRoundSettings data-slot="icon" />
        </Button>
      </div>
    </HStack>
  )
}

export function IconSize() {
  return (
    <Stack>
      <HStack>
        <Button size="icon">
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" appearance="outline">
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" appearance="plain">
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" appearance="active">
          <IcRoundRefresh data-slot="icon" />
        </Button>
      </HStack>
      <HStack>
        <Button size="icon" intent="secondary">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="secondary" appearance="outline">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="secondary" appearance="plain">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="danger">
          <IcRoundClose data-slot="icon" />
        </Button>
        <Button size="icon" intent="danger" appearance="outline">
          <IcRoundClose data-slot="icon" />
        </Button>
      </HStack>
      <HStack>
        <Button size="icon" isDisabled>
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" appearance="outline" isDisabled>
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" appearance="plain" isDisabled>
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" intent="secondary" appearance="outline" isDisabled>
          <IcRoundSearch data-slot="icon" />
        </Button>
      </HStack>
    </Stack>
  )
}

export default {
  title: 'Components / Button'
}
