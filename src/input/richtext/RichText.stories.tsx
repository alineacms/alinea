import {dashboardDecorator} from 'alinea/dashboard/DashboardStory'
import {useField} from 'alinea/editor'
import {InputField} from 'alinea/editor/view/InputField'
import {richText} from 'alinea/input/richtext'

const lipsumDoc = [
  {
    type: 'heading',
    textAlign: 'left',
    level: 1,
    content: [{type: 'text', text: 'Lorem ipsum dolor sit amet'}]
  },
  {
    type: 'paragraph',
    textAlign: 'justify',
    content: [
      {
        type: 'text',
        text: 'Consectetur adipiscing elit. Proin fringilla nibh id ex elementum congue. Proin id elit vel velit semper sagittis. Ut vitae mauris faucibus, interdum erat et, dictum leo. Nulla semper nisl eget pellentesque elementum. Nullam convallis felis enim, sit amet molestie ligula laoreet nec. Donec vehicula leo quis laoreet ultricies. Suspendisse interdum tristique auctor. Donec hendrerit, nulla et ultrices maximus, ipsum augue efficitur metus, non pellentesque odio lorem id leo.'
      }
    ]
  },
  {
    type: 'heading',
    textAlign: 'left',
    level: 2,
    content: [{type: 'text', text: 'Suspendisse maximus'}]
  },
  {
    type: 'paragraph',
    textAlign: 'justify',
    content: [
      {
        type: 'text',
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed a varius mauris. Integer vel arcu tellus. Nulla sagittis elementum placerat. In vel mattis ligula, eget hendrerit libero. Nulla fermentum aliquam tellus sed sodales. Nullam eu feugiat neque, id pellentesque sapien. Sed quam nunc, placerat fringilla felis nec, molestie scelerisque metus. Nunc egestas augue eu gravida sagittis. Donec sodales, nunc vel lacinia rutrum, felis metus vestibulum justo, vitae vulputate magna elit in dui. Etiam ac ultrices mauris. Morbi mi nibh, maximus et sapien non, tempor tincidunt diam. Suspendisse tristique, lacus vitae laoreet aliquam, purus ipsum congue erat, nec pharetra elit lacus eu tortor. Nunc viverra odio metus, ut consequat enim consequat id. Pellentesque consequat consequat quam, id convallis ex cursus in. Proin elementum scelerisque odio sed blandit.'
      }
    ]
  },
  {
    type: 'heading',
    textAlign: 'left',
    level: 3,
    content: [{type: 'text', text: 'Cras massa elit'}]
  },
  {
    type: 'paragraph',
    textAlign: 'justify',
    content: [
      {
        type: 'text',
        text: 'Aenean quis ante lacinia, convallis purus ut, tempor tortor. Integer sed tortor non turpis consequat gravida. Aliquam dictum mauris fermentum nisl aliquet varius. Nullam vehicula nisi et justo consectetur, at gravida mauris convallis. Nullam eget bibendum lorem. Nam tincidunt sapien id eros consectetur vestibulum. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vivamus dignissim pulvinar sem, nec dictum eros volutpat nec.'
      }
    ]
  },
  {
    type: 'heading',
    textAlign: 'left',
    level: 2,
    content: [{type: 'text', text: 'Aenean quis ante lacinia'}]
  },
  {
    type: 'paragraph',
    textAlign: 'justify',
    content: [
      {
        type: 'text',
        text: 'Sed a metus porttitor tellus ornare porta eget lacinia dolor. Mauris ut quam malesuada, pharetra massa vel, congue nibh. Quisque vel erat non urna rutrum posuere. Quisque eu lorem erat. Suspendisse libero magna, auctor varius urna sed, ornare consequat risus. Morbi finibus lectus orci, sit amet lacinia odio posuere ut. Nunc pellentesque felis vitae nunc cursus, vel tristique lacus ullamcorper. Suspendisse et enim id quam finibus pretium. Vivamus auctor sapien sit amet euismod lobortis. Aenean ut tristique tellus. Nunc eu aliquam sapien. Donec finibus justo tellus, nec eleifend nisl dapibus quis. Cras massa elit, rutrum id odio nec, commodo tempus risus. Phasellus blandit, nunc at aliquet cursus, lectus eros eleifend sem, et pellentesque nibh sem eu mi. Maecenas dapibus orci non neque condimentum consequat.'
      }
    ]
  }
]

export function Example() {
  const richTextField = useField(
    richText('Rich text example', {
      initialValue: lipsumDoc
    })
  )
  return <InputField {...richTextField} />
}

export default {
  title: 'Fields / Rich text',
  decorators: dashboardDecorator({fullWidth: true, fullHeight: true})
}
