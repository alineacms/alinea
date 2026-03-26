import {
  Button,
  Icon,
  Label,
  Menu,
  MenuItem,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator
} from '@alinea/components'
import styler from '@alinea/styler'
import {RichTextField as CoreRichTextField} from 'alinea/core/field/RichTextField'
import {Schema} from 'alinea/core/Schema'
import {RichTextOptions} from 'alinea/field/richtext/RichTextField'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {useFieldOptions} from 'alinea/v2/store'
import {memo, useMemo} from 'react'
import {createPortal} from 'react-dom'
import css from './RichTextField.module.css'

const styles = styler(css)

export interface RichTextFieldViewProps<Blocks extends Schema> {
  field: CoreRichTextField<Blocks, RichTextOptions<Blocks>>
}

export const RichTextFieldView = memo(function RichTextFieldView<
  Blocks extends Schema
>({field}: RichTextFieldViewProps<Blocks>) {
  const options = useFieldOptions(field)
  const toolbar = useMemo(() => document.getElementById('alinea-toolbar'), [])
  return (
    <>
      <Label
        description={options.help}
        isRequired={options.required}
        label={options.label}
      >
        here comes text
      </Label>
      {toolbar && createPortal(<RichTextToolbar />, toolbar)}
    </>
  )
})

function RichTextToolbar() {
  return (
    <Toolbar aria-label="Text formatting" data-orientation="horizontal">
      <ToolbarGroup>
        <Menu
          label={
            <Button appearance="plain">
              Options...
              <IcRoundUnfoldMore />
            </Button>
          }
        >
          <MenuItem>
            <IcRoundUnfoldMore />
            Undo
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Redo
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Insert Link
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Insert Image
          </MenuItem>
          <MenuItem>
            <IcRoundUnfoldMore />
            Insert Grid
          </MenuItem>
        </Menu>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <Button
          size="square-petite"
          appearance="plain"
          data-appearance="active"
        >
          <Icon icon={IcRoundUnfoldMore} />
        </Button>

        <Menu
          label={
            <Button size="large" appearance="plain">
              <Icon icon={IcRoundUnfoldMore} />
              <Icon icon={IcRoundUnfoldMore} />
            </Button>
          }
        >
          <MenuItem>
            <IcRoundUnfoldMore />
            Undo
          </MenuItem>
        </Menu>
      </ToolbarGroup>
    </Toolbar>
  )
}
