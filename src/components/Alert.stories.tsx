import type {CSSProperties} from 'react'
import {
  IcBaselineErrorOutline,
  IcRoundTranslate,
  IcRoundWarning
} from '../dashboard/icons.js'
import {Alert, AlertActions, AlertDescription, AlertTitle} from './Alert.js'
import {Button} from './Button.js'
import {Checkbox} from './Checkbox.js'

const storyStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  maxWidth: 640,
  padding: 24
}

export function Example() {
  return (
    <div style={storyStyle}>
      <Alert icon={IcRoundTranslate} aria-label="Translation">
        <AlertTitle>This entry has not been translated yet</AlertTitle>
        <AlertDescription>
          Start from an empty entry or copy the fields of another translation.
        </AlertDescription>
        <AlertActions>
          <Checkbox defaultChecked>Copy from existing translation</Checkbox>
        </AlertActions>
      </Alert>
      <Alert variant="warning" icon={IcRoundWarning}>
        <AlertTitle>Translate the parent entry first</AlertTitle>
        <AlertDescription>
          This translation can be created once its parent is translated.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive" icon={IcBaselineErrorOutline}>
        <AlertTitle>Could not save the user</AlertTitle>
        <AlertDescription>
          The email address is already in use.
        </AlertDescription>
        <AlertActions>
          <Button size="sm" variant="outline">
            Try again
          </Button>
        </AlertActions>
      </Alert>
      <Alert variant="destructive">
        <AlertDescription>
          Only a description, without an icon.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default {
  title: 'Pure components / Alert'
}
