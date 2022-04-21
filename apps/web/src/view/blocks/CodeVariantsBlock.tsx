import {fromModule, HStack, Typo} from '@alinea/ui'
import {useState} from 'react'
import css from './CodeVariantsBlock.module.scss'
import {CodeVariantsBlockProps} from './CodeVariantsBlock.query'

const styles = fromModule(css)

// Todo: fix accessibility when picking a component framework
export function CodeVariantsBlock({variants}: CodeVariantsBlockProps) {
  const [selected, setSelected] = useState(variants[0]?.name)
  return (
    <div className={styles.root()}>
      <HStack>
        {variants.map(variant => {
          return (
            <button
              className={styles.root.trigger({
                selected: variant.name === selected
              })}
              key={variant.id}
              onClick={() => setSelected(variant.name)}
            >
              {variant.name}
            </button>
          )
        })}
      </HStack>
      {variants.map(variant => {
        if (selected !== variant.name) return null
        return (
          <div className={styles.root.code()} key={variant.id}>
            {variant.code && (
              <Typo.Monospace
                as="div"
                dangerouslySetInnerHTML={{__html: variant.code}}
                className={styles.root.code()}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
