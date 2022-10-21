import {RichText} from '@alinea/ui'
import {TextDoc} from 'alinea'

type Props = {
  title: string
  byline: TextDoc
}

const Intro = ({title, byline}: Props) => {
  return (
    <section className="flex-col md:flex-row flex items-center md:justify-between mt-16 mb-16 md:mb-12">
      <h1 className="text-5xl md:text-8xl font-bold tracking-tighter leading-tight md:pr-8">
        {title}
      </h1>
      <h4 className="text-center md:text-left text-lg mt-5 md:pl-8">
        <RichText
          doc={byline}
          a={
            <a className="underline hover:text-blue-600 duration-200 transition-colors" />
          }
        />
      </h4>
    </section>
  )
}

export default Intro
