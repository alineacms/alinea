import React, {Fragment} from 'react'
import {DemoFooter} from '../components/footer/DemoFooter'
import {DemoHeader} from '../components/header/DemoHeader'

export const DemoLayout: React.FC<{children: React.ReactNode}> = ({
  children
}) => {
  return (
    <Fragment>
      <DemoHeader />
      {children}
      <DemoFooter />
    </Fragment>
  )
}
