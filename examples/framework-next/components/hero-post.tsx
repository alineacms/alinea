import {RichText} from '@alinea/ui'
import {TextDoc} from 'alinea'
import Link from 'next/link'
import type {Author} from '../schema/author'
import Avatar from './avatar'
import CoverImage from './cover-image'
import DateFormatter from './date-formatter'

type Props = {
  title: string
  coverImage: string
  date: string
  excerpt: TextDoc
  author: Author
  slug: string
}

const HeroPost = ({title, coverImage, date, excerpt, author, slug}: Props) => {
  return (
    <section>
      <div className="mb-8 md:mb-16">
        <CoverImage title={title} src={coverImage} slug={slug} />
      </div>
      <div className="md:grid md:grid-cols-2 md:gap-x-16 lg:gap-x-8 mb-20 md:mb-28">
        <div>
          <h3 className="mb-4 text-4xl lg:text-5xl leading-tight">
            <Link as={`/posts/${slug}`} href="/posts/[slug]">
              <a className="hover:underline">{title}</a>
            </Link>
          </h3>
          <div className="mb-4 md:mb-0 text-lg">
            <DateFormatter dateString={date} />
          </div>
        </div>
        <div>
          <RichText
            doc={excerpt}
            p={<p className="text-lg leading-relaxed mb-4" />}
          />
          <Avatar name={author.title} picture={author.picture} />
        </div>
      </div>
    </section>
  )
}

export default HeroPost
