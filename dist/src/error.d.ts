import { Errors } from "node-universe";
declare const ERR_NO_TOKEN = "NO_TOKEN";
declare const ERR_INVALID_TOKEN = "INVALID_TOKEN";
declare const ERR_UNABLE_DECODE_PARAM = "UNABLE_DECODE_PARAM";
declare const ERR_ORIGIN_NOT_FOUND = "ORIGIN_NOT_FOUND";
declare const ERR_ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED";
declare class InvalidRequestBodyError extends Errors.UniverseError {
    constructor(body?: any, error?: any);
}
declare class InvalidResponseTypeError extends Errors.UniverseError {
    constructor(dataType?: string);
}
declare class UnAuthorizedError extends Errors.UniverseError {
    constructor(type?: string, data?: any);
}
declare class ForbiddenError extends Errors.UniverseError {
    constructor(type?: string, data?: any);
}
declare class BadRequestError extends Errors.UniverseError {
    constructor(type?: string, data?: any);
}
declare class NotFoundError extends Errors.UniverseError {
    constructor(type?: string, data?: any);
}
declare class PayloadTooLarge extends Errors.StarClientError {
    constructor(data?: any);
}
declare class RateLimitExceeded extends Errors.StarClientError {
    constructor(type?: string, data?: any);
}
declare class ServiceUnavailableError extends Errors.UniverseError {
    constructor(type?: string, data?: any);
}
export { InvalidRequestBodyError, InvalidResponseTypeError, UnAuthorizedError, ForbiddenError, BadRequestError, NotFoundError, PayloadTooLarge, RateLimitExceeded, ServiceUnavailableError, ERR_NO_TOKEN, ERR_INVALID_TOKEN, ERR_UNABLE_DECODE_PARAM, ERR_ORIGIN_NOT_FOUND, ERR_ORIGIN_NOT_ALLOWED, };
