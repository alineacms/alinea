export declare const DemoRecipe: import("alinea").Type<{
    title: import("../../src/field/text").TextField;
    path: import("../../src/field/path").PathField;
    header: import("../../src/field/object").ObjectField<{
        image: import("../../src/field/link").ImageField<undefined>;
        credit: import("alinea/core/field/RichTextField").RichTextField<{}, import("alinea/field/richtext/RichTextField").RichTextOptions<{}>>;
    }> & {
        image: import("../../src/field/link").ImageField<undefined>;
        credit: import("alinea/core/field/RichTextField").RichTextField<{}, import("alinea/field/richtext/RichTextField").RichTextOptions<{}>>;
    };
    intro: import("alinea/core/field/RichTextField").RichTextField<{}, import("alinea/field/richtext/RichTextField").RichTextOptions<{}>>;
    ingredients: import("alinea/core/field/RichTextField").RichTextField<{}, import("alinea/field/richtext/RichTextField").RichTextOptions<{}>>;
    instructions: import("alinea/core/field/RichTextField").RichTextField<{}, import("alinea/field/richtext/RichTextField").RichTextOptions<{}>>;
}>;
