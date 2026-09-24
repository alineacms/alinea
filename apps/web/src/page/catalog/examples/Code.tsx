'use client'

import {Code, Text} from 'alinea/components'

export function CodeExample() {
  return (
    <div style={{display: 'grid', gap: 12, width: 420}}>
      <Text as="p">
        The product lives at <Code>/products/linen-shirt</Code> in the{' '}
        <Code variant="outline">Products</Code> root.
      </Text>
      <Code block>
        {`const Product = Config.document('Product', {
  fields: {
    title: Field.text('Title'),
    price: Field.number('Price')
  }
})`}
      </Code>
    </div>
  )
}
