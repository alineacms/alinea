import { Config, Field } from "alinea";

export const ListFields = Config.document("List fields", {
  fields: {
    sizes: Field.list("Compact list", {
      help: "Enter adds a size, Backspace in an empty one removes it",
      compact: true,
      schema: {
        Size: Config.type("Size", {
          fields: {
            label: Field.text("Label", { width: 0.6 }),
            code: Field.text("Code", { width: 0.4 }),
          },
          tabs: {
            stock: Field.tab("Stock", {
              fields: { stock: Field.number("In stock") },
            }),
          },
        }),
      },
      initialValue: [
        { _type: "Size", label: "Small", code: "S" },
        { _type: "Size", label: "Medium", code: "M" },
        { _type: "Size", label: "Large", code: "L" },
      ],
    }),
    list: Field.list("My list field", {
      schema: {
        Text: Config.type("Text", {
          fields: {
            title: Field.text("Item title"),
            text: Field.richText("Item body text"),
          },
        }),
        Image: Config.type("Image", {
          fields: { image: Field.image("Image") },
        }),
      },
    }),
    listWithInitial: Field.list("My list field", {
      collapsed: true,
      schema: {
        Text: Config.type("Text", {
          fields: {
            title: Field.text("Item title"),
            text: Field.richText("Item body text"),
          },
        }),
        Image: Config.type("Image", {
          fields: { image: Field.image("Image") },
        }),
      },
      initialValue: [
        {
          _type: "Text",
          title: "Initial item",
          text: [
            {
              _type: "paragraph",
              content: [
                {
                  _type: "text",
                  text: "This is an initial item",
                },
              ],
            },
          ],
        },
        {
          _type: "Text",
          title: "Initial item",
          text: [
            {
              _type: "paragraph",
              content: [
                {
                  _type: "text",
                  text: "This is an initial item",
                },
              ],
            },
          ],
        },
      ],
    }),
  },
});
