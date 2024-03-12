import Alias$1 from '@/alias';
import { ServerResponse, IncomingMessage } from 'http';
import bodyParser from 'body-parser';
import serveStatic from 'serve-static';

interface GenericObject {
    [name: string]: any;
}
declare class Route {
    callOptions?: any;
    cors?: CorsOptions;
    etag?: any;
    hasWhitelist?: boolean;
    logging?: boolean;
    mappingPolicy?: string;
    middlewares?: Function[];
    onBeforeCall?: onBeforeCall;
    onAfterCall?: onAfterCall;
    opts?: any;
    path?: string;
    whitelist?: string[];
}
interface CorsOptions {
    origin?: boolean | string | RegExp | (string | RegExp)[] | CustomOrigin;
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
}
type CustomOrigin = (origin: string) => boolean;
type onBeforeCall = (ctx: any, route: Route, req: IncomingRequest, res: GatewayResponse) => void;
type onAfterCall = (ctx: any, route: Route, req: IncomingRequest, res: GatewayResponse, data: any) => any;
declare class GatewayResponse extends ServerResponse {
    $ctx: any;
    $route?: Route;
    $service?: any;
    locals?: Record<string, unknown>;
}
declare class IncomingRequest extends IncomingMessage {
    $action: any;
    $alias?: Alias$1;
    $ctx?: any;
    $endpoint?: any;
    $next: any;
    $params: any;
    $route?: Route;
    $service?: any;
    $startTime?: number[];
    originalUrl?: string;
    parsedUrl?: string;
    query?: Record<string, string>;
}

declare class Alias {
    service: any;
    route: Route;
    type: string;
    method: string;
    path: string | null;
    handler: any;
    action: string | null;
    fullPath: string;
    keys: Array<any>;
    re: any;
    busboyConfig: any;
    constructor(service: any, route: Route, opts: any, action: any);
    match(url: any): {};
    isMethod(method: any): boolean;
    printPath(): string;
    toString(): string;
    multipartHandler(req: any, res: any): void;
}

declare class MemoryStore {
    hits: Map<any, any>;
    resetTime: number;
    timer: any;
    constructor(clearPeriod: number);
    inc(key: string): number;
    reset(): void;
}

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
        reformatError(err: any, req: any, res: any): Pick<any, "data" | "name" | "message" | "code" | "type">;
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
    RateLimitStores: {
        MemoryStore: typeof MemoryStore;
    };
};

declare const ERR_NO_TOKEN = "NO_TOKEN";
declare const ERR_INVALID_TOKEN = "INVALID_TOKEN";
declare const ERR_UNABLE_DECODE_PARAM = "UNABLE_DECODE_PARAM";
declare const ERR_ORIGIN_NOT_FOUND = "ORIGIN_NOT_FOUND";
declare const ERR_ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED";
declare const UniverseError: {
    new (message: string, code?: any, type?: any, data?: any): {
        code: UniverseErrorCode;
        type: UniverseErrorOptionsType;
        data?: any;
        retryable: boolean;
        name: string;
        message: string;
        stack?: string | undefined;
        cause?: unknown;
    };
    captureStackTrace(targetObject: object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
declare const StarClientError: {
    new (message: string, code: UniverseErrorCode, type: UniverseErrorOptionsType, data?: any): {
        code: UniverseErrorCode;
        type: UniverseErrorOptionsType;
        data?: any;
        retryable: boolean;
        name: string;
        message: string;
        stack?: string | undefined;
        cause?: unknown;
    };
    captureStackTrace(targetObject: object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
declare class InvalidRequestBodyError extends UniverseError {
    constructor(body?: any, error?: any);
}
declare class InvalidResponseTypeError extends UniverseError {
    constructor(dataType?: string);
}
declare class UnAuthorizedError extends UniverseError {
    constructor(type?: string, data?: any);
}
declare class ForbiddenError extends UniverseError {
    constructor(type?: string, data?: any);
}
declare class BadRequestError extends UniverseError {
    constructor(type?: string, data?: any);
}
declare class NotFoundError extends UniverseError {
    constructor(type?: string, data?: any);
}
declare class PayloadTooLarge extends StarClientError {
    constructor(data?: any);
}
declare class RateLimitExceeded extends StarClientError {
    constructor(type?: string, data?: any);
}
declare class ServiceUnavailableError extends UniverseError {
    constructor(type?: string, data?: any);
}

type error_BadRequestError = BadRequestError;
declare const error_BadRequestError: typeof BadRequestError;
declare const error_ERR_INVALID_TOKEN: typeof ERR_INVALID_TOKEN;
declare const error_ERR_NO_TOKEN: typeof ERR_NO_TOKEN;
declare const error_ERR_ORIGIN_NOT_ALLOWED: typeof ERR_ORIGIN_NOT_ALLOWED;
declare const error_ERR_ORIGIN_NOT_FOUND: typeof ERR_ORIGIN_NOT_FOUND;
declare const error_ERR_UNABLE_DECODE_PARAM: typeof ERR_UNABLE_DECODE_PARAM;
type error_ForbiddenError = ForbiddenError;
declare const error_ForbiddenError: typeof ForbiddenError;
type error_InvalidRequestBodyError = InvalidRequestBodyError;
declare const error_InvalidRequestBodyError: typeof InvalidRequestBodyError;
type error_InvalidResponseTypeError = InvalidResponseTypeError;
declare const error_InvalidResponseTypeError: typeof InvalidResponseTypeError;
type error_NotFoundError = NotFoundError;
declare const error_NotFoundError: typeof NotFoundError;
type error_PayloadTooLarge = PayloadTooLarge;
declare const error_PayloadTooLarge: typeof PayloadTooLarge;
type error_RateLimitExceeded = RateLimitExceeded;
declare const error_RateLimitExceeded: typeof RateLimitExceeded;
type error_ServiceUnavailableError = ServiceUnavailableError;
declare const error_ServiceUnavailableError: typeof ServiceUnavailableError;
declare const error_StarClientError: typeof StarClientError;
type error_UnAuthorizedError = UnAuthorizedError;
declare const error_UnAuthorizedError: typeof UnAuthorizedError;
declare const error_UniverseError: typeof UniverseError;
declare namespace error {
  export {
    error_BadRequestError as BadRequestError,
    error_ERR_INVALID_TOKEN as ERR_INVALID_TOKEN,
    error_ERR_NO_TOKEN as ERR_NO_TOKEN,
    error_ERR_ORIGIN_NOT_ALLOWED as ERR_ORIGIN_NOT_ALLOWED,
    error_ERR_ORIGIN_NOT_FOUND as ERR_ORIGIN_NOT_FOUND,
    error_ERR_UNABLE_DECODE_PARAM as ERR_UNABLE_DECODE_PARAM,
    error_ForbiddenError as ForbiddenError,
    error_InvalidRequestBodyError as InvalidRequestBodyError,
    error_InvalidResponseTypeError as InvalidResponseTypeError,
    error_NotFoundError as NotFoundError,
    error_PayloadTooLarge as PayloadTooLarge,
    error_RateLimitExceeded as RateLimitExceeded,
    error_ServiceUnavailableError as ServiceUnavailableError,
    error_StarClientError as StarClientError,
    error_UnAuthorizedError as UnAuthorizedError,
    error_UniverseError as UniverseError,
  };
}

export { Alias, error as Erros, _default as UniverseWeb };
