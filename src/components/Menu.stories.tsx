import {useState} from 'react'
import {
  MenuSection,
  type Selection as SelectionType
} from 'react-aria-components'
import {Stack} from '../stories/Stack.tsx'
import {IcRoundArchive} from '../stories/icons/IcRoundArchive.tsx'
import {IcRoundHistory} from '../stories/icons/IcRoundHistory.tsx'
import {Button} from './Button.tsx'
import {Icon} from './Icon.tsx'
import {Menu, MenuHeader, MenuItem, MenuSeparator} from './Menu.tsx'

const items = [
  {id: 1, name: 'New'},
  {id: 2, name: 'Open'},
  {id: 3, name: 'Close'},
  {id: 4, name: 'Save'},
  {id: 5, name: 'Duplicate'},
  {id: 6, name: 'Rename'},
  {id: 7, name: 'Move'}
]

const languages = [
  ['Abkhazian', 'ab'],
  ['Afar', 'aa'],
  ['Afrikaans', 'af'],
  ['Akan', 'ak'],
  ['Albanian', 'sq'],
  ['Amharic', 'am'],
  ['Arabic', 'ar'],
  ['Aragonese', 'an'],
  ['Argentina', 'es-ar'],
  ['Armenian', 'hy'],
  ['Assamese', 'as'],
  ['Avaric', 'av'],
  ['Avestan', 'ae'],
  ['Aymara', 'ay'],
  ['Azerbaijani', 'az'],
  ['Bambara', 'bm'],
  ['Bashkir', 'ba'],
  ['Basque', 'eu'],
  ['Belarusian', 'be'],
  ['Bengali (Bangla)', 'bn'],
  ['Bihari', 'bh'],
  ['Bislama', 'bi'],
  ['Bosnian', 'bs'],
  ['Breton', 'br'],
  ['Bulgarian', 'bg'],
  ['Burmese', 'my'],
  ['Catalan', 'ca'],
  ['Chamorro', 'ch'],
  ['Chechen', 'ce'],
  ['Chichewa, Chewa, Nyanja', 'ny'],
  ['Chinese', 'zh'],
  ['Chinese (Simplified)', 'zh-Hans'],
  ['Chinese (Traditional)', 'zh-Hant'],
  ['Chuvash', 'cv'],
  ['Cornish', 'kw'],
  ['Corsican', 'co'],
  ['Cree', 'cr'],
  ['Croatian', 'hr'],
  ['Czech', 'cs'],
  ['Danish', 'da'],
  ['Divehi, Dhivehi, Maldivian', 'dv'],
  ['Dutch', 'nl'],
  ['Dzongkha', 'dz'],
  ['English', 'en'],
  ['Esperanto', 'eo'],
  ['Estonian', 'et'],
  ['Ewe', 'ee'],
  ['Faroese', 'fo'],
  ['Fijian', 'fj'],
  ['Finnish', 'fi'],
  ['French', 'fr'],
  ['Fula, Fulah, Pulaar, Pular', 'ff'],
  ['Galician', 'gl'],
  ['Gaelic (Scottish)', 'gd'],
  ['Gaelic (Manx)', 'gv'],
  ['Georgian', 'ka'],
  ['German', 'de'],
  ['Greek', 'el'],
  ['Greenlandic', 'kl'],
  ['Guarani', 'gn'],
  ['Gujarati', 'gu'],
  ['Haitian Creole', 'ht'],
  ['Hausa', 'ha'],
  ['Hebrew', 'he'],
  ['Herero', 'hz'],
  ['Hindi', 'hi'],
  ['Hiri Motu', 'ho'],
  ['Hungarian', 'hu'],
  ['Icelandic', 'is'],
  ['Ido', 'io'],
  ['Igbo', 'ig'],
  ['Indonesian', 'id, in'],
  ['Interlingua', 'ia'],
  ['Interlingue', 'ie'],
  ['Inuktitut', 'iu'],
  ['Inupiak', 'ik'],
  ['Irish', 'ga'],
  ['Italian', 'it'],
  ['Japanese', 'ja'],
  ['Javanese', 'jv'],
  ['Kalaallisut, Greenlandic', 'kl'],
  ['Kannada', 'kn'],
  ['Kanuri', 'kr'],
  ['Kashmiri', 'ks'],
  ['Kazakh', 'kk'],
  ['Khmer', 'km'],
  ['Kikuyu', 'ki'],
  ['Kinyarwanda (Rwanda)', 'rw'],
  ['Kirundi', 'rn'],
  ['Kyrgyz', 'ky'],
  ['Komi', 'kv'],
  ['Kongo', 'kg'],
  ['Korean', 'ko'],
  ['Kurdish', 'ku'],
  ['Kwanyama', 'kj'],
  ['Lao', 'lo'],
  ['Latin', 'la'],
  ['Latvian (Lettish)', 'lv'],
  ['Limburgish ( Limburger)', 'li'],
  ['Lingala', 'ln'],
  ['Lithuanian', 'lt'],
  ['Luga-Katanga', 'lu'],
  ['Luganda, Ganda', 'lg'],
  ['Luxembourgish', 'lb'],
  ['Manx', 'gv'],
  ['Macedonian', 'mk'],
  ['Malagasy', 'mg'],
  ['Malay', 'ms'],
  ['Malayalam', 'ml'],
  ['Maltese', 'mt'],
  ['Maori', 'mi'],
  ['Marathi', 'mr'],
  ['Marshallese', 'mh'],
  ['Moldavian', 'mo'],
  ['Mongolian', 'mn'],
  ['Nauru', 'na'],
  ['Navajo', 'nv'],
  ['Ndonga', 'ng'],
  ['Northern Ndebele', 'nd'],
  ['Nepali', 'ne'],
  ['Norwegian', 'no'],
  ['Norwegian bokmål', 'nb'],
  ['Norwegian nynorsk', 'nn'],
  ['Nuosu', 'ii'],
  ['Occitan', 'oc'],
  ['Ojibwe', 'oj'],
  ['Old Church Slavonic, Old Bulgarian', 'cu'],
  ['Oriya', 'or'],
  ['Oromo (Afaan Oromo)', 'om'],
  ['Ossetian', 'os'],
  ['Pāli', 'pi'],
  ['Pashto, Pushto', 'ps'],
  ['Persian (Farsi)', 'fa'],
  ['Polish', 'pl'],
  ['Portuguese', 'pt'],
  ['Punjabi (Eastern)', 'pa'],
  ['Quechua', 'qu'],
  ['Romansh', 'rm'],
  ['Romanian', 'ro'],
  ['Russian', 'ru'],
  ['Sami', 'se'],
  ['Samoan', 'sm'],
  ['Sango', 'sg'],
  ['Sanskrit', 'sa'],
  ['Serbian', 'sr'],
  ['Serbo-Croatian', 'sh'],
  ['Sesotho', 'st'],
  ['Setswana', 'tn'],
  ['Shona', 'sn'],
  ['Sichuan Yi', 'ii'],
  ['Sindhi', 'sd'],
  ['Sinhalese', 'si'],
  ['Siswati', 'ss'],
  ['Slovak', 'sk'],
  ['Slovenian', 'sl'],
  ['Somali', 'so'],
  ['Southern Ndebele', 'nr'],
  ['Spanish', 'es'],
  ['Sundanese', 'su'],
  ['Swahili (Kiswahili)', 'sw'],
  ['Swati', 'ss'],
  ['Swedish', 'sv'],
  ['Tagalog', 'tl'],
  ['Tahitian', 'ty'],
  ['Tajik', 'tg'],
  ['Tamil', 'ta'],
  ['Tatar', 'tt'],
  ['Telugu', 'te'],
  ['Thai', 'th'],
  ['Tibetan', 'bo'],
  ['Tigrinya', 'ti'],
  ['Tonga', 'to'],
  ['Tsonga', 'ts'],
  ['Turkish', 'tr'],
  ['Turkmen', 'tk'],
  ['Twi', 'tw'],
  ['Uyghur', 'ug'],
  ['Ukrainian', 'uk'],
  ['Urdu', 'ur'],
  ['Uzbek', 'uz'],
  ['Venda', 've'],
  ['Vietnamese', 'vi'],
  ['Volapük', 'vo'],
  ['Wallon', 'wa'],
  ['Welsh', 'cy'],
  ['Wolof', 'wo'],
  ['Western Frisian', 'fy'],
  ['Xhosa', 'xh'],
  ['Yiddish', 'yi', 'ji'],
  ['Yoruba', 'yo'],
  ['Zhuang, Chuang', 'za'],
  ['Zulu', 'zu']
]

export const Example = () => (
  <Stack>
    <Menu label="Default">
      {items.map(item => (
        <MenuItem key={item.id}>{item.name}</MenuItem>
      ))}
    </Menu>

    <Menu
      label="Language"
      selectionMode="single"
      selectedKeys={[languages[0][0]]}
    >
      {languages.map(([language]) => (
        <MenuItem id={language} key={language}>
          {language}
        </MenuItem>
      ))}
    </Menu>

    <Menu
      label="Menu with disabledKeys"
      disabledKeys={['react-aria-4', 'react-aria-6']}
    >
      {items.map(item => (
        <MenuItem key={item.id}>{item.name}</MenuItem>
      ))}
    </Menu>

    <Menu label="Menu with icons">
      <MenuItem>
        <Icon icon={IcRoundHistory} data-slot="icon" />
        Show history
      </MenuItem>
      <MenuItem>
        <Icon icon={IcRoundArchive} data-slot="icon" />
        Archive
      </MenuItem>
    </Menu>

    <Menu label="Separator and sections">
      <MenuSection>
        <MenuHeader>Styles</MenuHeader>
        <MenuItem>Bold</MenuItem>
        <MenuSeparator />
        <MenuItem>Underline</MenuItem>
      </MenuSection>
      <MenuSection>
        <MenuHeader>Align</MenuHeader>
        <MenuItem>Left</MenuItem>
        <MenuItem>Middle</MenuItem>
        <MenuItem>Right</MenuItem>
      </MenuSection>
    </Menu>
  </Stack>
)

export const Selection = () => {
  const [style, setStyle] = useState<SelectionType>(new Set(['bold']))
  const [align, setAlign] = useState<SelectionType>(new Set(['left']))

  return (
    <>
      <Menu label="Actions">
        <MenuSection>
          <MenuHeader>Actions</MenuHeader>
          <MenuItem>Cut</MenuItem>
          <MenuItem>Copy</MenuItem>
          <MenuItem>Paste</MenuItem>
        </MenuSection>
        <MenuSection
          selectionMode="multiple"
          selectedKeys={style}
          onSelectionChange={setStyle}
        >
          <MenuHeader>Style (selectionMode multiple)</MenuHeader>
          <MenuItem id="bold">Bold</MenuItem>
          <MenuItem id="italic">Italic</MenuItem>
          <MenuItem id="underline">Underline</MenuItem>
        </MenuSection>
        <MenuSection
          selectionMode="single"
          selectedKeys={align}
          onSelectionChange={setAlign}
        >
          <MenuHeader>Alignment (selectionMode single)</MenuHeader>
          <MenuItem id="left">Left</MenuItem>
          <MenuItem id="center">Center</MenuItem>
          <MenuItem id="right">Right</MenuItem>
        </MenuSection>
      </Menu>

      <p>Current selection (controlled): {[...style, ...align].join(', ')}</p>
    </>
  )
}

export const Submenus = () => (
  <Menu label={<Button intent="secondary">Actions</Button>}>
    <MenuItem>Cut</MenuItem>
    <MenuItem>Copy</MenuItem>
    <MenuItem>Delete</MenuItem>
    <Menu label={<MenuItem>Share</MenuItem>}>
      <MenuItem>SMS</MenuItem>
      <MenuItem>X</MenuItem>
      <Menu label={<MenuItem>Email</MenuItem>}>
        <MenuItem>Work</MenuItem>
        <MenuItem>Personal</MenuItem>
      </Menu>
    </Menu>
  </Menu>
)

export default {
  title: 'Components / Menu'
}
