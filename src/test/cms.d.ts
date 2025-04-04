import * as schema from './schema/index.js';
export declare const cms: import("alinea/adapter/core/cms.js").CoreCMS<{
    schema: typeof schema;
    workspaces: {
        demo: import("alinea").Workspace<{
            pages: import("alinea").Root<import("alinea/core/Root.js").ChildrenDefinition>;
            media: import("alinea/core/media/MediaRoot.js").MediaRoot<import("alinea/core/Root.js").ChildrenDefinition>;
        }>;
    };
    baseUrl: {
        production: string;
        development: string;
    };
    handlerUrl: string;
    dashboardFile: string;
    preview: true;
}>;
