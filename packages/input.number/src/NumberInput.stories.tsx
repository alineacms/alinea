import { dashboardDecorator } from "@alinea/dashboard/DashboardStory";
import { useField } from "@alinea/editor/index";
import { InputField } from '@alinea/editor/view/InputField';
import { VStack } from "@alinea/ui";
import { number } from "./view";

export function NumberInput() {
  const defaultNumberInput = useField(number('Number', {}))
  const initialNumberInput = useField(number('Number (initial value: 100)', {
    initialValue: 100
  }))
  const minNumberInput = useField(number('Number (minimum value: 50)', {
    minValue: 50
  }))
  const maxNumberInput = useField(number('Number (maximum value: 500)', {
    maxValue: 500
  }))
  const minMaxNumberInput = useField(number('Number (minimum value: 50, maximum value: 500)', {
    minValue: 50,
    maxValue: 500
  }))
  const initialMinMaxNumberInput = useField(number('Number (initial value: 100, minimum value: 50, maximum value: 500)', {
    initialValue: 100,
    minValue: 50,
    maxValue: 500
  }))
  
  return (
    <VStack>
      <InputField {...defaultNumberInput} />
      <InputField {...initialNumberInput} />
      <InputField {...minNumberInput} />
      <InputField {...maxNumberInput} />
      <InputField {...minMaxNumberInput} />
      <InputField {...initialMinMaxNumberInput} />
    </VStack>)
}

export default {
  title: 'Fields / Number',
  decorators: dashboardDecorator({fullWidth: true})
}