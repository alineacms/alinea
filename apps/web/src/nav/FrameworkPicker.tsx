import {HStack, fromModule} from 'alinea/ui'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {SVGProps} from 'react'
import css from './FrameworkPicker.module.scss'

const styles = fromModule(css)

export function TablerBrandJavascript(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      >
        <path d="m20 4l-2 14.5l-6 2l-6-2L4 4z"></path>
        <path d="M7.5 8h3v8l-2-1m8-7H14a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h1.423a.5.5 0 0 1 .495.57L15.5 15.5l-2 .5"></path>
      </g>
    </svg>
  )
}

export function TablerBrandNextjs(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 15V9l7.745 10.65A9 9 0 1 1 19 17.657M15 12V9"
      ></path>
    </svg>
  )
}

export function FrameworkPicker() {
  return (
    <div className={styles.picker()}>
      <button className={styles.picker.trigger()}>
        <HStack>
          <div>
            <small>Integrate with</small>
            <HStack center gap={8}>
              <TablerBrandNextjs />
              <span>Next.js</span>
            </HStack>
          </div>
          <IcRoundKeyboardArrowDown />
        </HStack>
      </button>
      <div className={styles.picker.options()}>
        <button className={styles.picker.options.option()}>
          <HStack center gap={8}>
            <TablerBrandNextjs />
            <span>Next.js</span>
          </HStack>
        </button>

        <button className={styles.picker.options.option()}>
          <HStack center gap={8}>
            <TablerBrandJavascript />
            <span>Vanilla js</span>
          </HStack>
        </button>

        <div className={styles.picker.options.option({disabled: true})}>
          More coming soon
        </div>
      </div>
    </div>
  )
}
