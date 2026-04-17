import {ColorSwatchPicker, ColorSwatchPickerItem} from './ColorSwatchPicker.tsx'

export const Example = (args: any) => (
  <ColorSwatchPicker {...args}>
    <ColorSwatchPickerItem color="#A00" />
    <ColorSwatchPickerItem color="#f80" />
    <ColorSwatchPickerItem color="#080" />
    <ColorSwatchPickerItem color="#08f" />
    <ColorSwatchPickerItem color="#088" />
    <ColorSwatchPickerItem color="#008" />
  </ColorSwatchPicker>
)

export default {title: 'Components / ColorSwatchPicker'}
