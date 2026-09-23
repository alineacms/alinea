export const theme = {
  $schema: 'vscode://schemas/color-theme',
  name: 'dark-plus',
  tokenColors: [
    {
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: ['meta.embedded', 'source.groovy.embedded'],
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: 'emphasis',
      settings: {
        fontStyle: 'italic'
      }
    },
    {
      scope: 'strong',
      settings: {
        fontStyle: 'bold'
      }
    },
    {
      scope: 'header',
      settings: {
        foreground: '#000080'
      }
    },
    {
      scope: 'comment',
      settings: {
        foreground: '#7c80a0'
      }
    },
    {
      scope: 'constant.language',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: [
        'constant.numeric',
        'variable.other.enummember',
        'keyword.operator.plus.exponent',
        'keyword.operator.minus.exponent'
      ],
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      scope: 'constant.regexp',
      settings: {
        foreground: '#8d92b8'
      }
    },
    {
      scope: 'entity.name.tag',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'entity.name.tag.css',
      settings: {
        foreground: '#f2c97d'
      }
    },
    {
      scope: 'entity.other.attribute-name',
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: [
        'entity.other.attribute-name.class.css',
        'entity.other.attribute-name.class.mixin.css',
        'entity.other.attribute-name.id.css',
        'entity.other.attribute-name.parent-selector.css',
        'entity.other.attribute-name.pseudo-class.css',
        'entity.other.attribute-name.pseudo-element.css',
        'source.css.less entity.other.attribute-name.id',
        'entity.other.attribute-name.scss'
      ],
      settings: {
        foreground: '#f2c97d'
      }
    },
    {
      scope: 'invalid',
      settings: {
        foreground: '#f44747'
      }
    },
    {
      scope: 'markup.underline',
      settings: {
        fontStyle: 'underline'
      }
    },
    {
      scope: 'markup.bold',
      settings: {
        fontStyle: 'bold',
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'markup.heading',
      settings: {
        fontStyle: 'bold',
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'markup.italic',
      settings: {
        fontStyle: 'italic'
      }
    },
    {
      scope: 'markup.strikethrough',
      settings: {
        fontStyle: 'strikethrough'
      }
    },
    {
      scope: 'markup.inserted',
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      scope: 'markup.deleted',
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      scope: 'markup.changed',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'punctuation.definition.quote.begin.markdown',
      settings: {
        foreground: '#7c80a0'
      }
    },
    {
      scope: 'punctuation.definition.list.begin.markdown',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'markup.inline.raw',
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      name: 'brackets of XML/HTML tags',
      scope: 'punctuation.definition.tag',
      settings: {
        foreground: '#8d92b8'
      }
    },
    {
      scope: ['meta.preprocessor', 'entity.name.function.preprocessor'],
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'meta.preprocessor.string',
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      scope: 'meta.preprocessor.numeric',
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      scope: 'meta.structure.dictionary.key.python',
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: 'meta.diff.header',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'storage',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'storage.type',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: ['storage.modifier', 'keyword.operator.noexcept'],
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: ['string', 'meta.embedded.assembly'],
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      scope: 'string.tag',
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      scope: 'string.value',
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      scope: 'string.regexp',
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      name: 'String interpolation',
      scope: [
        'punctuation.definition.template-expression.begin',
        'punctuation.definition.template-expression.end',
        'punctuation.section.embedded'
      ],
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      name: 'Reset JavaScript string interpolation expression',
      scope: ['meta.template.expression'],
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: [
        'support.type.vendored.property-name',
        'support.type.property-name',
        'variable.css',
        'variable.scss',
        'variable.other.less',
        'source.coffee.embedded'
      ],
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: 'keyword',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'keyword.control',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'keyword.operator',
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: [
        'keyword.operator.new',
        'keyword.operator.expression',
        'keyword.operator.cast',
        'keyword.operator.sizeof',
        'keyword.operator.alignof',
        'keyword.operator.typeid',
        'keyword.operator.alignas',
        'keyword.operator.instanceof',
        'keyword.operator.logical.python',
        'keyword.operator.wordlike'
      ],
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'keyword.other.unit',
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      scope: [
        'punctuation.section.embedded.begin.php',
        'punctuation.section.embedded.end.php'
      ],
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'support.function.git-rebase',
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      scope: 'constant.sha.git-rebase',
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      name: 'coloring of the Java import and package identifiers',
      scope: [
        'storage.modifier.import.java',
        'variable.language.wildcard.java',
        'storage.modifier.package.java'
      ],
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      name: 'this.self',
      scope: 'variable.language',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      name: 'Function declarations',
      scope: [
        'entity.name.function',
        'support.function',
        'support.constant.handlebars',
        'source.powershell variable.other.member',
        'entity.name.operator.custom-literal'
      ],
      settings: {
        foreground: '#f2c97d'
      }
    },
    {
      name: 'Types declaration and references',
      scope: [
        'support.class',
        'support.type',
        'entity.name.type',
        'entity.name.namespace',
        'entity.other.attribute',
        'entity.name.scope-resolution',
        'entity.name.class',
        'storage.type.numeric.go',
        'storage.type.byte.go',
        'storage.type.boolean.go',
        'storage.type.string.go',
        'storage.type.uintptr.go',
        'storage.type.error.go',
        'storage.type.rune.go',
        'storage.type.cs',
        'storage.type.generic.cs',
        'storage.type.modifier.cs',
        'storage.type.variable.cs',
        'storage.type.annotation.java',
        'storage.type.generic.java',
        'storage.type.java',
        'storage.type.object.array.java',
        'storage.type.primitive.array.java',
        'storage.type.primitive.java',
        'storage.type.token.java',
        'storage.type.groovy',
        'storage.type.annotation.groovy',
        'storage.type.parameters.groovy',
        'storage.type.generic.groovy',
        'storage.type.object.array.groovy',
        'storage.type.primitive.array.groovy',
        'storage.type.primitive.groovy'
      ],
      settings: {
        foreground: '#8fd3ff'
      }
    },
    {
      name: 'Types declaration and references, TS grammar specific',
      scope: [
        'meta.type.cast.expr',
        'meta.type.new.expr',
        'support.constant.math',
        'support.constant.dom',
        'support.constant.json',
        'entity.other.inherited-class'
      ],
      settings: {
        foreground: '#8fd3ff'
      }
    },
    {
      name: 'Control flow / Special keywords',
      scope: [
        'keyword.control',
        'source.cpp keyword.operator.new',
        'keyword.operator.delete',
        'keyword.other.using',
        'keyword.other.operator',
        'entity.name.operator'
      ],
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      name: 'Variable and parameter name',
      scope: [
        'variable',
        'meta.definition.variable.name',
        'support.variable',
        'entity.name.variable',
        'constant.other.placeholder'
      ],
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      name: 'Constants and enums',
      scope: ['variable.other.constant', 'variable.other.enummember'],
      settings: {
        foreground: '#8fd3ff'
      }
    },
    {
      name: 'Object keys, TS grammar specific',
      scope: ['meta.object-literal.key'],
      settings: {
        foreground: '#e6e8f5'
      }
    },
    {
      name: 'CSS property value',
      scope: [
        'support.constant.property-value',
        'support.constant.font-name',
        'support.constant.media-type',
        'support.constant.media',
        'constant.other.color.rgb-value',
        'constant.other.rgb-value',
        'support.constant.color'
      ],
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      name: 'Regular expression groups',
      scope: [
        'punctuation.definition.group.regexp',
        'punctuation.definition.group.assertion.regexp',
        'punctuation.definition.character-class.regexp',
        'punctuation.character.set.begin.regexp',
        'punctuation.character.set.end.regexp',
        'keyword.operator.negation.regexp',
        'support.other.parenthesis.regexp'
      ],
      settings: {
        foreground: '#7fe0b8'
      }
    },
    {
      scope: [
        'constant.character.character-class.regexp',
        'constant.other.character-class.set.regexp',
        'constant.other.character-class.regexp',
        'constant.character.set.regexp'
      ],
      settings: {
        foreground: '#f2a58e'
      }
    },
    {
      scope: ['keyword.operator.or.regexp', 'keyword.control.anchor.regexp'],
      settings: {
        foreground: '#f2c97d'
      }
    },
    {
      scope: 'keyword.operator.quantifier.regexp',
      settings: {
        foreground: '#f2c97d'
      }
    },
    {
      scope: 'constant.character',
      settings: {
        foreground: '#9da3fa'
      }
    },
    {
      scope: 'constant.character.escape',
      settings: {
        foreground: '#f2c97d'
      }
    },
    {
      scope: 'entity.name.label',
      settings: {
        foreground: '#e6e8f5'
      }
    }
  ],
  semanticTokenColors: {
    newOperator: '#9da3fa',
    stringLiteral: '#7fe0b8',
    customLiteral: '#f2c97d',
    numberLiteral: '#f2a58e'
  },
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#e6e8f5',
    'editor.inactiveSelectionBackground': '#3A3D41',
    'editorIndentGuide.background': '#404040',
    'editorIndentGuide.activeBackground': '#707070',
    'editor.selectionHighlightBackground': '#ADD6FF26',
    'list.dropBackground': '#383B3D',
    'activityBarBadge.background': '#007ACC',
    'sideBarTitle.foreground': '#BBBBBB',
    'input.placeholderForeground': '#A6A6A6',
    'menu.background': '#252526',
    'menu.foreground': '#CCCCCC',
    'statusBarItem.remoteForeground': '#FFF',
    'statusBarItem.remoteBackground': '#16825D',
    'ports.iconRunningProcessForeground': '#369432',
    'sideBarSectionHeader.background': '#0000',
    'sideBarSectionHeader.border': '#ccc3',
    'tab.lastPinnedBorder': '#ccc3',
    'list.activeSelectionIconForeground': '#FFF'
  }
}
