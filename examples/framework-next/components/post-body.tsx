import {RichText} from '@alinea/ui'
import {TextDoc} from 'alinea'
import markdownStyles from './markdown-styles.module.css'

type Props = {
  content: TextDoc
}

const PostBody = ({content}: Props) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className={markdownStyles['markdown']}>
        <RichText doc={content} />
      </div>
    </div>
  )
}

export default PostBody
