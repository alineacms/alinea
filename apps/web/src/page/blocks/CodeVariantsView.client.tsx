'use client'

import {WebTypo} from '@/layout/WebTypo'
import {CodeVariantsBlock} from '@/schema/blocks/CodeVariantsBlock'
import {Infer} from 'alinea'
import {HStack, fromModule} from 'alinea/ui'
import {useAtom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import css from './CodeVariantsView.module.scss'

const styles = fromModule(css)

const preferenceAtom = atomWithStorage<string | undefined>(
  `@alinea/codevariant`,
  undefined
)

export function CodeVariantTabs({variants}: Infer<typeof CodeVariantsBlock>) {
  const [variantPreference, setVariantPreference] = useAtom(preferenceAtom)
  const isOption = variants.find(variant => variant.name === variantPreference)
  const selectedVariant = isOption ? variantPreference : variants[0]?.name
  return (
    <div className={styles.root()}>
      <HStack center gap={10} className={styles.root.triggers()}>
        {variants.map(variant => {
          return (
            <button
              key={variant._id}
              className={styles.root.trigger({
                selected: selectedVariant === variant.name
              })}
              onClick={() => setVariantPreference(variant.name)}
            >
              {variant.name}
            </button>
          )
        })}
      </HStack>

      {variants.map(variant => {
        if (selectedVariant !== variant.name) return null
        return (
          <div className={styles.root.code()} key={variant._id}>
            {variant.code && (
              <WebTypo.Monospace
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
