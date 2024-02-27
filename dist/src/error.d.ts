/// <reference types="node" />
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
export { InvalidRequestBodyError, InvalidResponseTypeError, UnAuthorizedError, ForbiddenError, BadRequestError, NotFoundError, PayloadTooLarge, RateLimitExceeded, ServiceUnavailableError, UniverseError, StarClientError, ERR_NO_TOKEN, ERR_INVALID_TOKEN, ERR_UNABLE_DECODE_PARAM, ERR_ORIGIN_NOT_FOUND, ERR_ORIGIN_NOT_ALLOWED, };
