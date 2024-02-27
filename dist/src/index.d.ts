import { GenericObject } from "./typings";
import Alias from "./alias";
import bodyParser from "body-parser";
import serveStatic from "serve-static";
declare const _default: {
    name: string;
    settings: {
        port: string | number;
        ip: string;
        server: boolean;
        routes: never[];
        logRequest: string;
        logRequestParams: string;
        logResponse: string;
        logResponseData: null;
        log4XXResponses: boolean;
        logRouteRegistration: string;
        http2: boolean;
        httpServerTimeout: null;
        requestTimeout: number;
        optimizeOrder: boolean;
        rootCallOptions: null;
        debounceTime: number;
    };
    metadata: {
        $category: string;
        $description: string;
        $official: boolean;
        $package: {
            name: string;
            version: string;
        };
    };
    actions: {
        rest: {
            visibility: string;
            tracing: {
                tags: {
                    params: string[];
                };
                spanName: (ctx: any) => string;
            };
            timeout: number;
            handler(ctx: any): any;
        };
        listAliases: {
            rest: string;
            params: {
                grouping: {
                    type: string;
                    optional: boolean;
                    convert: boolean;
                };
                withActionSchema: {
                    type: string;
                    optional: boolean;
                    convert: boolean;
                };
            };
            handler(ctx: any): any[];
        };
        addRoute: {
            params: {
                route: {
                    type: string;
                };
                toBottom: {
                    type: string;
                    optional: boolean;
                    default: boolean;
                };
            };
            visibility: string;
            handler(ctx: any): any;
        };
        removeRoute: {
            params: {
                name: {
                    type: string;
                    optional: boolean;
                };
                path: {
                    type: string;
                    optional: boolean;
                };
            };
            visibility: string;
            handler(ctx: any): any;
        };
    };
    methods: {
        createServer(): void;
        errorHandler(req: any, res: any, err: any): void;
        corsHandler(settings: any, req: any, res: any): boolean;
        httpHandler(req: any, res: any, next: any): Promise<void>;
        routeHandler(ctx: any, route: any, req: any, res: any, foundAlias: any): Promise<unknown>;
        aliasHandler(req: any, res: any, alias: any): Promise<true | undefined>;
        callAction(route: any, actionName: any, req: any, res: any, params: any): Promise<true | undefined>;
        encodeResponse(req: any, res: any, data: any): string;
        sendResponse(req: any, res: any, data: any, action: any): any;
        express(): (req: any, res: any, next: any) => Promise<void>;
        send404(req: any, res: any): any;
        sendError(req: any, res: any, err: any): any;
        reformatError(err: any, req: any, res: any): Pick<any, "name" | "message" | "code" | "type" | "data">;
        sendRedirect(res: any, url: any, code?: number): void;
        parseQueryString(req: any): {
            query: {};
            url: any;
        };
        logRequest(req: any): void;
        coloringStatusCode(code: any): any;
        logResponse(req: any, res: any, data?: any): void;
        checkOrigin(origin: any, settings: any): any;
        writeCorsHeaders(route: any, req: any, res: any, isPreFlight: any): void;
        checkWhitelist(route: any, action: any): boolean;
        resolveAlias(url: any, method?: string): false | {
            alias: any;
            params: any;
        };
        addRoute(opts: any, toBottom?: boolean): GenericObject;
        removeRoute(path: any): boolean;
        removeRouteByName(name: any): boolean;
        optimizeRouteOrder(): void;
        createRoute(opts: any): GenericObject;
        createRouteAliases(route: any, aliases: any): void;
        isEqualRoutes(routeA: any, routeB: any): boolean;
        generateRESTAliases(route: any, path: any, action: any): Alias[];
        regenerateAutoAliases(route: any): void;
        parseActionRestString(restRoute: any, basePath: any): {
            method: any;
            path: any;
        };
        parseActionRestObject(restRoute: any, rawName: any, basePath: any): any;
        optimizeAliasesOrder(): void;
        createAlias(route: any, path: any, action: any): Alias;
        logRouteRegistration(message: any): void;
    };
    events: {
        "$services.changed"(): void;
    };
    created(): void;
    started(): Promise<unknown>;
    stopped(): Promise<unknown>;
    bodyParser: bodyParser.BodyParser;
    serveStatic: typeof serveStatic;
    Errors: any;
    RateLimitStores: {
        MemoryStore: any;
    };
};
export default _default;
