import styler from '@alinea/styler'
import {
  Children,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
  useRef
} from 'react'
import {useFilter} from 'react-aria'
import {
  Autocomplete,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Separator
} from 'react-aria-components'
import {IcRoundSearch} from '../dashboard/icons.js'
import css from './Command.module.css'
import {Icon} from './Icon.js'
import {SearchField} from './SearchField.js'
import type {AriaProps, DataProps, IconType, StyleProps} from './types.js'

const styles = styler(css)

/** Keywords of the rendered items, keyed by item value */
const CommandKeywordsContext = createContext<Map<string, Array<string>>>(
  new Map()
)

export interface CommandProps extends StyleProps, AriaProps, DataProps {
  /** CommandInput and CommandList */
  children: ReactNode
  /**
   * Whether items are filtered by the search query. Set to false when
   * filtering the items yourself. Defaults to true.
   */
  shouldFilter?: boolean
  /**
   * Custom matcher for an item: return 0 or false to hide it. `keywords`
   * holds the text of the item followed by its `keywords`. By default items
   * are shown when their text or one of their keywords contains the query,
   * ignoring case and accents.
   */
  filter?: (
    value: string,
    search: string,
    keywords: Array<string>
  ) => number | boolean
}

/**
 * A search input that filters a list of actions, as used in command palettes
 * and pickers. Compose with CommandInput, CommandList, CommandEmpty,
 * CommandGroup, CommandItem and CommandSeparator.
 */
export function Command({
  children,
  shouldFilter = true,
  filter,
  className,
  ...props
}: CommandProps) {
  const {contains} = useFilter({sensitivity: 'base'})
  const keywords = useRef(new Map<string, Array<string>>()).current
  function matches(textValue: string, search: string, key: string) {
    if (!search) return true
    const words = [textValue, ...(keywords.get(key) ?? [])]
    if (filter) {
      const score = filter(key, search, words)
      return typeof score === 'number' ? score > 0 : score
    }
    return words.some(word => contains(word, search))
  }
  return (
    <div
      data-slot="command"
      {...props}
      className={styles.Command(styler.merge({className}))}
    >
      <CommandKeywordsContext.Provider value={keywords}>
        <Autocomplete
          filter={
            shouldFilter
              ? (textValue, search, node) =>
                  matches(textValue, search, String(node.key))
              : undefined
          }
        >
          {children}
        </Autocomplete>
      </CommandKeywordsContext.Provider>
    </div>
  )
}

export interface CommandInputProps extends StyleProps, AriaProps, DataProps {
  placeholder?: string
  autoFocus?: boolean
  /** Defaults to a search icon */
  icon?: IconType | ReactElement
  /** Called when the search query changes */
  onValueChange?: (value: string) => void
}

export function CommandInput({
  icon = IcRoundSearch,
  'aria-label': ariaLabel,
  className,
  ...props
}: CommandInputProps) {
  return (
    <SearchField
      data-slot="command-input"
      {...props}
      aria-label={
        ariaLabel ?? (props['aria-labelledby'] ? undefined : 'Search')
      }
      className={styles.CommandInput(styler.merge({className}))}
      icon={icon}
    />
  )
}

export interface CommandListProps extends StyleProps, AriaProps, DataProps {
  /** CommandItem, CommandGroup, CommandSeparator and CommandEmpty elements */
  children: ReactNode
}

export function CommandList({children, className, ...props}: CommandListProps) {
  const empty: Array<ReactNode> = []
  const items: Array<ReactNode> = []
  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && child.type === CommandEmpty) empty.push(child)
    else items.push(child)
  }
  return (
    <ListBox
      data-slot="command-list"
      {...props}
      className={styles.CommandList(styler.merge({className}))}
      renderEmptyState={empty.length > 0 ? () => empty : undefined}
    >
      {items}
    </ListBox>
  )
}

export interface CommandEmptyProps extends StyleProps, DataProps {
  /** Shown when no item matches the search query */
  children: ReactNode
}

/** Place directly inside CommandList */
export function CommandEmpty({className, ...props}: CommandEmptyProps) {
  return (
    <div
      data-slot="command-empty"
      {...props}
      className={styles.CommandEmpty(styler.merge({className}))}
    />
  )
}

export interface CommandGroupProps extends StyleProps, AriaProps, DataProps {
  heading?: ReactNode
  children: ReactNode
}

export function CommandGroup({
  heading,
  children,
  className,
  ...props
}: CommandGroupProps) {
  return (
    <ListBoxSection
      data-slot="command-group"
      {...props}
      className={styles.CommandGroup(styler.merge({className}))}
    >
      {heading && (
        <Header
          data-slot="command-group-heading"
          className={styles.CommandGroup.heading()}
        >
          {heading}
        </Header>
      )}
      {children}
    </ListBoxSection>
  )
}

export interface CommandItemProps extends StyleProps, DataProps {
  /** Identifies the item, passed to `onSelect` and the `filter` */
  value: string
  /** Additional words the item is found by */
  keywords?: Array<string>
  /** Text the item is found by, defaults to its string children */
  textValue?: string
  /** Called when the item is clicked or chosen with Enter */
  onSelect?: (value: string) => void
  icon?: IconType | ReactElement
  disabled?: boolean
  children: ReactNode
}

export function CommandItem({
  value,
  keywords,
  textValue,
  onSelect,
  icon,
  disabled,
  children,
  className,
  ...props
}: CommandItemProps) {
  const registry = useContext(CommandKeywordsContext)
  if (keywords) registry.set(value, keywords)
  else registry.delete(value)
  const text =
    textValue ?? (typeof children === 'string' ? children : undefined)
  if (text === undefined)
    throw new Error(
      `Provide a textValue or a string child for the "${value}" command item`
    )
  return (
    <ListBoxItem
      data-slot="command-item"
      {...props}
      id={value}
      textValue={text}
      isDisabled={disabled}
      onAction={() => onSelect?.(value)}
      className={({isFocused}) =>
        styles.CommandItem({highlighted: isFocused}, styler.merge({className}))
      }
    >
      {icon && (
        <Icon
          aria-hidden
          icon={icon}
          data-slot="command-item-icon"
          className={styles.CommandItem.icon()}
        />
      )}
      <span className={styles.CommandItem.label()}>{children}</span>
    </ListBoxItem>
  )
}

export interface CommandSeparatorProps extends StyleProps, DataProps {}

export function CommandSeparator({className, ...props}: CommandSeparatorProps) {
  return (
    <Separator
      data-slot="command-separator"
      {...props}
      className={styles.CommandSeparator(styler.merge({className}))}
    />
  )
}
