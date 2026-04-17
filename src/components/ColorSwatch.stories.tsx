import {ColorSwatch} from './ColorSwatch.tsx'

export const Example = (args: any) => <ColorSwatch {...args} />

Example.args = {
  color: '#f00a'
}

export default {title: 'Components / ColorSwatch'}
