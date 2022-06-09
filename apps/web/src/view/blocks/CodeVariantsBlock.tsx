import {fromModule, HStack, Typo} from '@alinea/ui'
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState
} from 'react'
import css from './CodeVariantsBlock.module.scss'
import {CodeVariantsBlockSchema} from './CodeVariantsBlock.schema'

const styles = fromModule(css)

type CodeVariantsState = [
  selected: Array<string>,
  toggle: (previous: string, variant: string) => void
]

const context = createContext<CodeVariantsState | undefined>(undefined)

export function CodeVariantsProvider({children}: PropsWithChildren<{}>) {
  const persistenceId = `@alinea/web/variants`
  const [preferences, setPreferences] = useState<Array<string>>([])
  function togglePreference(previous: string, variant: string) {
    const res = preferences.filter(v => v !== previous).concat(variant)
    setPreferences(res)
    try {
      window.localStorage.setItem(persistenceId, JSON.stringify(res))
    } catch (e) {}
  }
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(persistenceId)
      if (stored) setPreferences(JSON.parse(stored))
    } catch (e) {}
  }, [])
  return (
    <context.Provider value={[preferences, togglePreference]}>
      {children}
    </context.Provider>
  )
}

// Todo: fix accessibility when picking a component framework
export function CodeVariantsBlock({variants}: CodeVariantsBlockSchema) {
  const [preferences, togglePreference] = useContext(context)!
  const names = variants.map(variant => variant.name)
  let selected = names[0]
  for (const name of names) {
    if (!preferences.includes(name)) continue
    selected = name
  }
  return (
    <div className={styles.root()}>
      <HStack>
        {variants.map(variant => {
          return (
            <button
              className={styles.root.trigger({
                selected: selected === variant.name
              })}
              key={variant.id}
              onClick={() => togglePreference(selected, variant.name)}
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
