import React from 'react'

// Source: https://codesandbox.io/s/typescript-as-prop-dicj8?file=/src/App.tsx:0-1216

// --------------------
// GENERIC TYPES
// --------------------

export type As<Props = any> = React.ElementType<Props>
// type Test = As<{ prop: string }>

export type PropsWithAs<Props = {}, Type extends As = As> = Props &
  Omit<React.ComponentProps<Type>, 'as' | keyof Props> & {
    as?: Type
  }
// type Test = PropsWithAs<{ prop: string }, As<{ prop2: string }>>["as"];
// type Test = PropsWithAs<{ prop: string }, As<{ prop2: string }>>["prop"];
// type Test = PropsWithAs<{ prop: string }, As<{ prop2: string }>>["prop2"];
// type Test = PropsWithAs<{ prop: string }, "a">["as"];
// type Test = PropsWithAs<{ prop: string }, "a">["href"];

export type ComponentWithAs<Props, DefaultType extends As> = {
  <Type extends As>(props: PropsWithAs<Props, Type> & {as: Type}): JSX.Element
  (props: PropsWithAs<Props, DefaultType>): JSX.Element
}
// type Test = ComponentWithAs<{ prop: string }, "button">;

// --------------------
// UTILS
// --------------------

export function forwardRefWithAs<Props, DefaultType extends As>(
  component: React.ForwardRefRenderFunction<any, any>
) {
  return React.forwardRef(component) as unknown as ComponentWithAs<
    Props,
    DefaultType
  >
}
