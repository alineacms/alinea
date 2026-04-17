import {Stack} from '../stories/Stack.tsx'
import {Checkbox} from './Checkbox.tsx'
import {CheckboxGroup} from './CheckboxGroup.tsx'

export const Example = (args: any) => (
  <Stack>
    <CheckboxGroup label="Favorite sport">
      <Checkbox value="soccer">Soccer</Checkbox>
      <Checkbox value="baseball">Baseball</Checkbox>
      <Checkbox value="basketball">Basketball</Checkbox>
    </CheckboxGroup>
    <CheckboxGroup
      label="Favorite codeurs member"
      description="Who is your favorite codeurs member?"
    >
      <Checkbox value="ben">Ben</Checkbox>
      <Checkbox value="stijn">Stijn</Checkbox>
      <Checkbox value="brecht">Brecht</Checkbox>
      <Checkbox value="dimi">Dimi</Checkbox>
      <Checkbox value="david">David</Checkbox>
    </CheckboxGroup>
    <CheckboxGroup
      label="favorite juice"
      isDisabled
      description="What is your favorite juice?"
    >
      <Checkbox value="apple">Apple</Checkbox>
      <Checkbox value="orange">Orange</Checkbox>
      <Checkbox value="grape">Grape</Checkbox>
    </CheckboxGroup>
    <form action="submit">
      <CheckboxGroup
        label="favorite tv series"
        isRequired
        description="What is your favorite tv series?"
      >
        <Checkbox value="breakingbad">Breaking Bad</Checkbox>
        <Checkbox value="gameofthrones">Game of Thrones</Checkbox>
        <Checkbox value="theoffice">The Office</Checkbox>
      </CheckboxGroup>
      <button type="submit">submit</button>
    </form>
  </Stack>
)

export default {
  title: 'Components / CheckboxGroup'
}
