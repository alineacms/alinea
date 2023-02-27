import {Page} from '@alinea/content'
import {fromModule} from 'alinea/ui'
import {DemoHeader} from '../layout/DemoHeader'
import {DemoLayout} from '../layout/DemoLayout'
import {DemoPage} from '../layout/DemoPage'
import {DemoText} from '../layout/DemoText'
import {DemoTypo} from '../layout/DemoType'
import css from './Recipe.module.scss'

const styles = fromModule(css)

type RelatedProps = {
  related: Array<Page.Recipe>
  category: string
}

export function Recipe({
  title,
  header,
  intro,
  ingredients,
  instructions
}: Page.Recipe & RelatedProps) {
  return (
    <DemoLayout>
      <DemoHeader {...header} />

      <DemoPage>
        <DemoPage.Container>
          <DemoTypo.H1>{title}</DemoTypo.H1>
          <DemoText doc={intro} />

          <section>
            <DemoTypo.H2>Ingredients</DemoTypo.H2>
            <DemoText doc={ingredients} />
          </section>

          <section>
            <DemoTypo.H2>Instructions</DemoTypo.H2>
            <DemoText doc={instructions} />
          </section>
        </DemoPage.Container>
      </DemoPage>
    </DemoLayout>
  )
}
