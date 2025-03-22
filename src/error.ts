import { Errors } from "node-universe";

const ERR_NO_TOKEN = "NO_TOKEN";
const ERR_INVALID_TOKEN = "INVALID_TOKEN";
const ERR_UNABLE_DECODE_PARAM = "UNABLE_DECODE_PARAM";
const ERR_ORIGIN_NOT_FOUND = "ORIGIN_NOT_FOUND";
const ERR_ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED";

class InvalidRequestBodyError extends Errors.UniverseError {
  constructor(body?: any, error?: any) {
    super("Invalid request body", 400, "INVALID_REQUEST_BODY", {
      body,
      error,
    });
  }
}

/**
 * Invalid response type
 */
class InvalidResponseTypeError extends Errors.UniverseError {
  constructor(dataType?: string) {
    super(`Invalid response type '${dataType}'`, 500, "INVALID_RESPONSE_TYPE", {
      dataType,
    });
  }
}

/**
 * Unauthorized HTTP error
 */
class UnAuthorizedError extends Errors.UniverseError {
  constructor(type?: string, data?: any) {
    super("Unauthorized", 401, type || ERR_INVALID_TOKEN, data);
  }
}

/**
 * Forbidden HTTP error
 */
class ForbiddenError extends Errors.UniverseError {
  constructor(type?: string, data?: any) {
    super("Forbidden", 403, type, data);
  }
}

/**
 * Bad request HTTP error
 */
class BadRequestError extends Errors.UniverseError {
  constructor(type?: string, data?: any) {
    super("Bad request", 400, type, data);
  }
}

/**
 * Not found HTTP error
 */
class NotFoundError extends Errors.UniverseError {
  constructor(type?: string, data?: any) {
    super("Not found", 404, type || "NOT_FOUND", data);
  }
}

/**
 * Payload is too large HTTP error
 */
class PayloadTooLarge extends Errors.StarClientError {
  constructor(data?: any) {
    super("Payload too large", 413, "PAYLOAD_TOO_LARGE", data);
  }
}

/**
 * Rate limit exceeded HTTP error
 */
class RateLimitExceeded extends Errors.StarClientError {
  constructor(type?: string, data?: any) {
    super("Rate limit exceeded", 429, `${type}`, data);
  }
}

/**
 * Service unavailable HTTP error
 */
class ServiceUnavailableError extends Errors.UniverseError {
  constructor(type?: string, data?: any) {
    super("Service unavailable", 503, type, data);
  }
}

export {
  InvalidRequestBodyError,
  InvalidResponseTypeError,
  UnAuthorizedError,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
  PayloadTooLarge,
  RateLimitExceeded,
  ServiceUnavailableError,
  ERR_NO_TOKEN,
  ERR_INVALID_TOKEN,
  ERR_UNABLE_DECODE_PARAM,
  ERR_ORIGIN_NOT_FOUND,
  ERR_ORIGIN_NOT_ALLOWED,
};
