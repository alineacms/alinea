// Source: https://github.com/buildo/react-autosize-textarea/blob/56225f8d8d2f1e5b3163442a0e2bccb2a7530931/src/TextareaAutosize.tsx

import autosize from 'autosize'
import _getLineHeight from 'line-height'
import React from 'react'

const getLineHeight = _getLineHeight as (element: HTMLElement) => number | null

export namespace TextareaAutosize {
  export type RequiredProps = Pick<
    React.HTMLProps<HTMLTextAreaElement>,
    Exclude<keyof React.HTMLProps<HTMLTextAreaElement>, 'ref'>
  > & {
    /** Called whenever the textarea resizes */
    onResize?: (e: Event) => void
    /** Minimum number of visible rows */
    rows?: React.HTMLProps<HTMLTextAreaElement>['rows']
    /** Maximum number of visible rows */
    maxRows?: number
    /** Initialize `autosize` asynchronously.
     * Enable it if you are using StyledComponents
     * This is forced to true when `maxRows` is set.
     */
    async?: boolean
  }
  export type DefaultProps = {
    rows: number
    async: boolean
  }
  export type Props = RequiredProps & Partial<DefaultProps>
  export type State = {
    lineHeight: number | null
  }
}

const RESIZED = 'autosize:resized'

type InnerProps = TextareaAutosize.Props & {
  innerRef: React.Ref<HTMLTextAreaElement> | null
}

/**
 * A light replacement for built-in textarea component
 * which automaticaly adjusts its height to match the content
 */
class TextareaAutosizeClass extends React.Component<
  InnerProps,
  TextareaAutosize.State
> {
  static defaultProps: TextareaAutosize.DefaultProps = {
    rows: 1,
    async: false
  }

  state: TextareaAutosize.State = {
    lineHeight: null
  }

  textarea: HTMLTextAreaElement | null = null
  currentValue: InnerProps['value']

  onResize = (e: Event): void => {
    if (this.props.onResize) {
      this.props.onResize(e)
    }
  }

  componentDidMount() {
    const {maxRows, async} = this.props

    if (typeof maxRows === 'number') {
      this.updateLineHeight()
    }

    if (typeof maxRows === 'number' || async) {
      /*
        the defer is needed to:
          - force "autosize" to activate the scrollbar when this.props.maxRows is passed
          - support StyledComponents (see #71)
      */
      setTimeout(() => this.textarea && autosize(this.textarea))
    } else {
      this.textarea && autosize(this.textarea)
    }

    if (this.textarea) {
      this.textarea.addEventListener(RESIZED, this.onResize)
    }
  }

  componentWillUnmount() {
    if (this.textarea) {
      this.textarea.removeEventListener(RESIZED, this.onResize)
      autosize.destroy(this.textarea)
    }
  }

  updateLineHeight = () => {
    if (this.textarea) {
      this.setState({
        lineHeight: getLineHeight(this.textarea)
      })
    }
  }

  onChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const {onChange} = this.props
    this.currentValue = e.currentTarget.value
    onChange && onChange(e)
  }

  render() {
    const {
      props: {onResize, maxRows, onChange, style, innerRef, children, ...props},
      state: {lineHeight}
    } = this

    const maxHeight = maxRows && lineHeight ? lineHeight * maxRows : null

    return (
      <textarea
        {...props}
        onChange={this.onChange}
        style={maxHeight ? {...style, maxHeight} : style}
        ref={element => {
          this.textarea = element
          if (typeof this.props.innerRef === 'function') {
            this.props.innerRef(element)
          } else if (this.props.innerRef) {
            ;(this.props.innerRef as any).current = element
          }
        }}
      >
        {children}
      </textarea>
    )
  }

  componentDidUpdate() {
    this.textarea && autosize.update(this.textarea)
  }
}

export const TextareaAutosize = React.forwardRef(
  (
    props: TextareaAutosize.Props,
    ref: React.Ref<HTMLTextAreaElement> | null
  ) => {
    return <TextareaAutosizeClass {...props} innerRef={ref} />
  }
)
