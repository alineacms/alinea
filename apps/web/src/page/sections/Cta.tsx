import styler from '@alinea/styler'
import type {Infer} from 'alinea'
import NextImage from 'next/image'
import heroBg from '@/assets/hero-alinea.jpg'
import {Button} from '@/layout/Button'
import {InstallCommand} from '@/layout/InstallCommand'
import {Section} from '@/layout/Section'
import type {Cta as CtaSchema} from '@/schema/sections/Cta'
import css from './Cta.module.scss'
import {resolveLink} from './links'

const styles = styler(css)

export interface CtaProps extends Infer<typeof CtaSchema> {}

export function Cta({title, text, link, command, background}: CtaProps) {
  const gradient = background !== 'surface'
  const action = resolveLink(link)
  return (
    <Section>
      <div className={styles.root({gradient})}>
        {gradient && (
          <>
            <NextImage
              src={heroBg}
              alt=""
              fill
              placeholder="blur"
              sizes="(max-width: 1440px) 100vw, 1280px"
              className={styles.root.background()}
            />
            <span className={styles.root.overlay()} />
          </>
        )}
        <div className={styles.root.content()}>
          {title && <h2 className={styles.root.title()}>{title}</h2>}
          {text && <p className={styles.root.text()}>{text}</p>}
          {(action || command) && (
            <div className={styles.root.actions()}>
              {action && (
                <Button href={action.href} target={action.target}>
                  {action.label}
                </Button>
              )}
              {command && (
                <InstallCommand
                  command={command}
                  className={styles.root.command()}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
