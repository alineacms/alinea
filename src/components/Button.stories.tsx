import {type HTMLAttributes, type PropsWithChildren, useState} from 'react'
import {
  IcRoundArchive,
  IcRoundClose,
  IcRoundHistory,
  IcRoundLanguage,
  IcRoundRefresh,
  IcRoundSearch,
  IcOutlineSettings as IcRoundSettings
} from '../dashboard/icons.js'
import {Button, type ButtonProps} from './Button.js'
import {ProgressCircle} from './ProgressCircle.js'

const HStack = (props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    {...props}
    style={{
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: 16,
      ...props.style
    }}
  />
)

const VStack = (props: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    {...props}
    style={{display: 'flex', flexDirection: 'column', gap: 16, ...props.style}}
  />
)

const IconExample = ({
  title,
  props
}: {
  title: string
  props?: ButtonProps
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }}
  >
    <Button size="icon" aria-label={title} {...props}>
      <IcRoundRefresh data-slot="icon" />
    </Button>
    <span style={{fontSize: 12}}>{title}</span>
  </div>
)

export function All() {
  return (
    <VStack>
      <HStack>
        <Button>Default</Button>
        <Button isDisabled>Default isDisabled</Button>
        <Button appearance="outline">Default Outline</Button>
        <Button appearance="outline" isDisabled>
          Default outline isDisabled
        </Button>
      </HStack>
      <HStack>
        <Button intent="primary">Primary</Button>
        <Button intent="primary" isDisabled>
          Primary isDisabled
        </Button>
        <Button intent="primary" appearance="outline">
          Primary outline
        </Button>
        <Button intent="primary" appearance="outline" isDisabled>
          Primary outline isDisabled
        </Button>
      </HStack>
      <HStack>
        <Button intent="secondary">Secondary</Button>
        <Button intent="secondary" isDisabled>
          Secondary isDisabled
        </Button>
        <Button intent="secondary" appearance="outline">
          Secondary outline
        </Button>
        <Button intent="secondary" appearance="outline" isDisabled>
          Secondary outline isDisabled
        </Button>
      </HStack>
      <HStack>
        <Button appearance="plain">Plain</Button>
        <Button appearance="plain" intent="primary">
          Plain primary
        </Button>
        <Button appearance="plain" intent="secondary">
          Plain secondary
        </Button>
      </HStack>
    </VStack>
  )
}

export function Appearance() {
  return (
    <VStack>
      <Button>Default</Button>
      <Button appearance="outline">Outline</Button>
      <Button appearance="plain">Plain</Button>
    </VStack>
  )
}

export function IconSize() {
  return (
    <VStack>
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
        <Button size="icon" isDisabled>
          <IcRoundRefresh data-slot="icon" />
        </Button>
        <Button size="icon" appearance="outline" isDisabled>
          <IcRoundRefresh data-slot="icon" />
        </Button>
      </HStack>
      <HStack>
        <Button size="icon" intent="primary">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="primary" appearance="outline">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="primary" appearance="plain">
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="primary" isDisabled>
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="primary" appearance="outline" isDisabled>
          <IcRoundSearch data-slot="icon" />
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
        <Button size="icon" intent="secondary" isDisabled>
          <IcRoundSearch data-slot="icon" />
        </Button>
        <Button size="icon" intent="secondary" appearance="outline" isDisabled>
          <IcRoundSearch data-slot="icon" />
        </Button>
      </HStack>
      <HStack>
        <Button size="icon" intent="warning">
          <IcRoundClose data-slot="icon" />
        </Button>
        <Button size="icon" intent="warning" appearance="outline">
          <IcRoundClose data-slot="icon" />
        </Button>
        <Button size="icon" intent="danger">
          <IcRoundClose data-slot="icon" />
        </Button>
        <Button size="icon" intent="danger" appearance="outline">
          <IcRoundClose data-slot="icon" />
        </Button>
      </HStack>
      <HStack>
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
          <Button size="icon-nav" appearance="plain" data-active>
            <IcRoundArchive data-slot="icon" />
          </Button>
          <Button size="icon-nav" appearance="plain">
            <IcRoundHistory data-slot="icon" />
          </Button>
          <Button size="icon-nav" appearance="plain">
            <IcRoundLanguage data-slot="icon" />
          </Button>
          <Button size="icon-nav" appearance="plain">
            <IcRoundSearch data-slot="icon" />
          </Button>
          <Button size="icon-nav" appearance="plain">
            <IcRoundSettings data-slot="icon" />
          </Button>
        </div>
      </HStack>
    </VStack>
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
    <VStack>
      <HStack>
        <Button>
          <IcRoundRefresh data-slot="icon" />
          With icon
        </Button>
        <Button
          isPending={isLoading}
          icon={IcRoundRefresh}
          onPress={handlePress}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
        <Button onPress={handlePress}>
          <>
            <ProgressCircle isIndeterminate aria-label="Loading..." />
            Loading...
          </>
        </Button>
      </HStack>
      <HStack>
        <IconExample title="Default" />
        <IconExample title="Primary" props={{intent: 'primary'}} />
        <IconExample title="Secondary" props={{intent: 'secondary'}} />
        <IconExample title="Outline" props={{appearance: 'outline'}} />
        <IconExample
          title="Outline primary"
          props={{appearance: 'outline', intent: 'primary'}}
        />
        <IconExample
          title="Outline secondary"
          props={{appearance: 'outline', intent: 'secondary'}}
        />
        <IconExample title="Plain" props={{appearance: 'plain'}} />
        <IconExample
          title="Plain primary"
          props={{appearance: 'plain', intent: 'primary'}}
        />
        <IconExample
          title="Plain secondary"
          props={{appearance: 'plain', intent: 'secondary'}}
        />
        <IconExample title="Active" props={{appearance: 'active'}} />
      </HStack>
    </VStack>
  )
}

export function Intents() {
  const intentsArray = [
    undefined,
    'primary',
    'secondary',
    'danger',
    'warning'
  ] as const
  const propsArray: {label: string; props?: ButtonProps}[] = [
    {label: ''},
    {props: {isDisabled: true}, label: 'isDisabled'},
    {props: {appearance: 'outline'}, label: 'Outline'},
    {
      props: {appearance: 'outline', isDisabled: true},
      label: 'Outline isDisabled'
    },
    {props: {appearance: 'plain'}, label: 'Plain'},
    {props: {appearance: 'plain', isDisabled: true}, label: 'Plain isDisabled'}
  ]

  return (
    <VStack>
      {intentsArray.map(intent => (
        <HStack key={intent}>
          {propsArray.map(({props, label}, index) => (
            <Button key={label} intent={intent} {...props}>
              {index === 0 && intent === undefined ? 'Default' : ''}
              {index === 0 && intent !== undefined
                ? intent.charAt(0).toUpperCase() + intent.slice(1)
                : label}
            </Button>
          ))}
        </HStack>
      ))}
    </VStack>
  )
}

export function Sizes() {
  return (
    <VStack>
      <HStack>
        <Button intent="primary" size="small">
          Small
        </Button>
        <Button intent="primary">Default</Button>
        <Button intent="primary" size="large">
          Large
        </Button>
      </HStack>
      <div style={{maxWidth: '150px'}}>
        <Button intent="primary" size="large">
          This is a large button with very long text
        </Button>
      </div>
    </VStack>
  )
}

export default {
  title: 'Components / Button'
}
