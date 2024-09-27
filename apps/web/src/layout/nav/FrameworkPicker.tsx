'use client'

import styler from '@alinea/styler'
import {HStack} from 'alinea/ui'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import Link from 'next/link'
import {useParams, usePathname, useRouter} from 'next/navigation'
import css from './FrameworkPicker.module.scss'
import {getFramework, supportedFrameworks} from './Frameworks'

const styles = styler(css)

export function FrameworkPicker() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const framework = getFramework(params.framework as string)
  return (
    <div className={styles.picker()}>
      <button className={styles.picker.trigger()}>
        <HStack center>
          <div>
            <small>Integrate with</small>
            <HStack center gap={8}>
              <framework.icon />
              <span>{framework.label}</span>
            </HStack>
          </div>
          <span className={styles.picker.trigger.arrow()}>
            <IcRoundKeyboardArrowDown />
          </span>
        </HStack>
      </button>
      <div className={styles.picker.options()}>
        {supportedFrameworks.map((framework, i) => {
          const prefix = i === 0 ? '/docs' : '/docs:' + framework.name
          const href = prefix + '/' + pathname.split('/').slice(2).join('/')
          return (
            <Link
              key={framework.name}
              href={href}
              onMouseDown={() => router.push(href)}
              className={styles.picker.options.option()}
            >
              <HStack center gap={8}>
                <framework.icon />
                <span>{framework.label}</span>
              </HStack>
            </Link>
          )
        })}

        <div className={styles.picker.options.option({disabled: true})}>
          More coming soon
        </div>
      </div>
    </div>
  )
}
