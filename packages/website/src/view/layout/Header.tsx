import {fromModule, HStack, Stack} from '@alinea/ui'
import Link from 'next/link'
import {AiFillTwitterCircle} from 'react-icons/ai'
import {IoLogoGithub} from 'react-icons/io'
import css from './Header.module.scss'
import {HeaderProps} from './Header.query'
import {Logo} from './Logo'

const styles = fromModule(css)

export function Header({links}: HeaderProps) {
  return (
    <header className={styles.root()}>
      <HStack center gap={36}>
        <Link href="/">
          <a style={{color: 'inherit'}}>
            <Logo />
          </a>
        </Link>
        <HStack center gap={36}>
          {links.map(link => {
            return (
              <Link key={link.id} href={link.url}>
                <a className={styles.root.link()}>{link.title}</a>
              </Link>
            )
          })}
        </HStack>
        <Stack.Right>
          <HStack gap={16} center>
            <IoLogoGithub size={25} />
            <AiFillTwitterCircle size={25} />
          </HStack>
        </Stack.Right>
      </HStack>
      <svg viewBox="0 0 36 18" className={styles.root.bg()}>
        <path d="M18 0C25.8884 0 29.9402 0.340637 32.8088 3.19123C35.6773 6.05976 36 10.1116 36 18V0H18Z" />
        <path d="M0 18C0 10.1116 0.340637 6.05976 3.19123 3.19123C6.05976 0.340637 10.1116 0 18 0H0V18Z" />
      </svg>
    </header>
  )
}
