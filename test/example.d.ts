import { LocalDB } from '#/core/db/LocalDB.js';
export declare const config: {
    schema: {
        Fields: import("#/index.js").Type<import("../src/core/Document").Document & {
            text: import("../src/field/text").TextField;
            hello: import("../src/field/text").TextField;
            richText: import("../src/core").RichTextField<{}, import("../src/field/richtext").RichTextOptions<{}>>;
            select: import("../src/field/select").SelectField<"a" | "b" | null, "a" | "b">;
            number: import("../src/field/number").NumberField;
            check: import("../src/field/check").CheckField;
            date: import("../src/field/date").DateField;
            code: import("../src/field/code").CodeField;
            externalLink: import("../src/field/link/LinkField").LinkField<import("#/index.js").UrlReference, import("#/index.js").UrlLink<{}>>;
            entry: import("../src/field/link/LinkField").LinkField<import("#/index.js").EntryReference, import("#/index.js").EntryLink<undefined>>;
            entryWithCondition: import("../src/field/link/LinkField").LinkField<import("#/index.js").EntryReference, import("#/index.js").EntryLink<undefined>>;
            linkMultiple: import("../src/field/link/LinkField").LinksField<import("../src/field/link").LinkRow, import("#/index.js").Link<{}>>;
            image: import("../src/field/link").ImageField<undefined>;
            images: import("../src/field/link").ImagesField<undefined>;
            file: import("../src/field/link/LinkField").LinkField<import("#/index.js").EntryReference, import("#/index.js").EntryLink<undefined>>;
            withFields: import("../src/field/link/LinkField").LinkField<import("../src/field/link").LinkRow, import("#/index.js").Link<{
                fieldA: string;
                fieldB: string;
            }>>;
            multipleWithFields: import("../src/field/link/LinkField").LinksField<import("../src/field/link").LinkRow, import("#/index.js").Link<{
                fieldA: string;
                fieldB: string;
            }>>;
            list: import("../src/core").ListField<({
                _type: "Image";
                image: import("#/index.js").EntryReference;
            } | {
                _type: "Text";
                title: string;
                text: import("#/index.js").TextDoc<{}>;
            }) & import("../src/core/ListRow").ListRow, ({
                _type: "Image";
                image: import("#/index.js").ImageLink<undefined>;
            } | {
                _type: "Text";
                title: string;
                text: import("#/index.js").TextDoc<{}>;
            }) & import("../src/core/ListRow").ListRow, import("../src/field/list").ListOptions<{
                Text: import("#/index.js").Type<{
                    title: import("../src/field/text").TextField;
                    text: import("../src/core").RichTextField<{}, import("../src/field/richtext").RichTextOptions<{}>>;
                }>;
                Image: import("#/index.js").Type<{
                    image: import("../src/field/link").ImageField<undefined>;
                }>;
            }>>;
            withInitial: import("../src/core").RichTextField<{}, import("../src/field/richtext").RichTextOptions<{}>>;
            nested: import("../src/core").RichTextField<{
                Inner: import("#/index.js").Type<{
                    checkbox1: import("../src/field/check").CheckField;
                    checkbox2: import("../src/field/check").CheckField;
                    title: import("../src/field/text").TextField;
                    content: import("../src/core").RichTextField<{}, import("../src/field/richtext").RichTextOptions<{}>>;
                }>;
                NestLayout: import("#/index.js").Type<{
                    object: import("../src/field/object").ObjectField<{
                        fieldA: import("../src/field/text").TextField;
                        fieldB: import("../src/field/text").TextField;
                    }> & {
                        fieldA: import("../src/field/text").TextField;
                        fieldB: import("../src/field/text").TextField;
                    };
                    tabA: import("../src/field/text").TextField;
                    tabB: import("../src/field/text").TextField;
                }>;
            }, import("../src/field/richtext").RichTextOptions<{
                Inner: import("#/index.js").Type<{
                    checkbox1: import("../src/field/check").CheckField;
                    checkbox2: import("../src/field/check").CheckField;
                    title: import("../src/field/text").TextField;
                    content: import("../src/core").RichTextField<{}, import("../src/field/richtext").RichTextOptions<{}>>;
                }>;
                NestLayout: import("#/index.js").Type<{
                    object: import("../src/field/object").ObjectField<{
                        fieldA: import("../src/field/text").TextField;
                        fieldB: import("../src/field/text").TextField;
                    }> & {
                        fieldA: import("../src/field/text").TextField;
                        fieldB: import("../src/field/text").TextField;
                    };
                    tabA: import("../src/field/text").TextField;
                    tabB: import("../src/field/text").TextField;
                }>;
            }>>;
        }>;
        Page: import("#/index.js").Type<import("../src/core/Document").Document & {
            title: import("../src/field/text").TextField;
            path: import("../src/field/path").PathField;
            name: import("../src/field/path").PathField & import("../src/field/text").TextField;
            entryLink: import("../src/field/link/LinkField").LinksField<import("../src/field/link").LinkRow, import("#/index.js").Link<{}>>;
            list: import("../src/core").ListField<{
                _type: "item";
                itemId: string;
            } & import("../src/core/ListRow").ListRow, {
                _type: "item";
                itemId: string;
            } & import("../src/core/ListRow").ListRow, import("../src/field/list").ListOptions<{
                item: import("#/index.js").Type<{
                    itemId: import("../src/field/text").TextField;
                }>;
            }>>;
            name2: import("../src/field/text").TextField;
        }>;
        Container: import("#/index.js").Type<{
            title: import("../src/field/text").TextField;
            path: import("../src/field/path").PathField;
            name: import("../src/field/text").TextField;
        }>;
    };
    workspaces: {
        main: import("#/index.js").Workspace<{
            pages: import("#/index.js").Root<{
                entry1: import("../src/core/Page").Page<Record<string, never>>;
                entry2: import("../src/core/Page").Page<{
                    entry3: never;
                }>;
                container1: import("../src/core/Page").Page<Record<string, never>>;
            }>;
            multiLanguage: import("#/index.js").Root<{
                localised1: import("../src/core/Page").Page<Record<string, never>>;
                localised2: import("../src/core/Page").Page<{
                    localised3: never;
                }>;
            }>;
            media: import("#/core/media/MediaRoot.js").MediaRoot<{
                dir: import("../src/core/Page").Page<{
                    'file1.png': never;
                }>;
            }>;
        }>;
    };
};
export declare function createExample(): Promise<LocalDB>;
