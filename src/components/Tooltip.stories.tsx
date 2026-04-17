import {Button} from 'react-aria-components'
import {Stack} from '../stories/Stack.tsx'
import {Tooltip} from './Tooltip.tsx'

export const Basic = () => (
  <div style={{paddingBlock: '80px'}}>
    <Stack align="center" gap={64}>
      <Tooltip tooltip="Save">
        <Button>💾</Button>
      </Tooltip>

      <Tooltip tooltip="Delete">
        <Button>❌</Button>
      </Tooltip>
    </Stack>
  </div>
)

export const Positions = () => (
  <div style={{paddingBlock: '80px'}}>
    <Stack align="center" gap={32}>
      <Tooltip
        placement="start"
        tooltip="
      In left-to-right, this is on the left. In right-to-left, this is on the
      right."
      >
        <Button>⬅️</Button>
      </Tooltip>

      <Tooltip placement="top" tooltip="This tooltip is above the button">
        <Button>⬆️</Button>
      </Tooltip>

      <Tooltip placement="bottom" tooltip="This tooltip is below the button.">
        <Button>⬇️</Button>
      </Tooltip>

      <Tooltip
        placement="end"
        tooltip="In left-to-right, this is on the right. In right-to-left, this is on the
      left."
      >
        <Button>➡️</Button>
      </Tooltip>
    </Stack>
  </div>
)

export const DelayedTooltip = () => (
  <Tooltip delay={500} tooltip="Tooltip appears after 500ms">
    <Button>⏳</Button>
  </Tooltip>
)

export const InteractiveTooltip = () => (
  <Tooltip
    tooltip={
      <Stack>
        <strong>Important Info</strong>
        <p>This tooltip contains multiple elements.</p>
      </Stack>
    }
  >
    <Button>🛠️ Hover for info</Button>
  </Tooltip>
)

export const DisabledButtonTooltip = () => (
  <Tooltip tooltip="Cannot perform this action">
    <Button isDisabled>🔒</Button>
  </Tooltip>
)

export default {
  title: 'Components / Tooltip'
}
