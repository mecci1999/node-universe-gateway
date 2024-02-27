import Universe from "node-universe";
import {
  BadRequestError,
  ERR_UNABLE_DECODE_PARAM,
  UniverseError,
} from "./error";
import _ from "lodash";
import etag from "etag";
import fresh from "fresh";

const RegexCache = new Map();

function decodeParam(param: string) {
  try {
    return decodeURIComponent(param);
  } catch (error) {
    throw new BadRequestError(ERR_UNABLE_DECODE_PARAM, { param });
  }
}

function removeTrailingSlashes(s) {
  if (s.startsWith("/")) s = s.slice(1);
  if (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function addSlashes(s) {
  return (s.startsWith("/") ? "" : "/") + s + (s.endsWith("/") ? "" : "/");
}

function normalizePath(s) {
  return s.replace(/\/{2,}/g, "/");
}

/**
 * Compose middlewares
 */
function compose(...mws: any) {
  // @ts-ignore
  const self = this;
  return (req, res, done) => {
    const next = (i: any, err?: any) => {
      if (i >= mws.length) {
        if (_.isFunction(done)) return done.call(self, err);

        /* istanbul ignore next */
        return;
      }

      if (err) {
        // Call only error middlewares (err, req, res, next)
        if (mws[i].length == 4)
          mws[i].call(self, err, req, res, (err) => next(i + 1, err));
        else next(i + 1, err);
      } else {
        if (mws[i].length < 4)
          mws[i].call(self, req, res, (err) => next(i + 1, err));
        else next(i + 1);
      }
    };

    return next(0);
  };
}

/**
 * Compose middlewares and return Promise
 */
function composeThen(req, res, ...mws) {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    compose.call(this, ...mws)(req, res, (err) => {
      if (err) {
        /* istanbul ignore next */
        if (err instanceof UniverseError) return reject(err);

        /* istanbul ignore next */
        if (err instanceof Error)
          return reject(
            new UniverseError(
              err.message,
              (err as any).code || (err as any).status,
              (err as any).type,
            ),
          ); // TODO err.stack

        /* istanbul ignore next */
        return reject(new UniverseError(err));
      }

      resolve(true);
    });
  });
}

/**
 * Generate ETag from content.
 */
function generateETag(body: any, opt: any) {
  // @ts-ignore
  if (_.isFunction(opt)) return opt.call(this, body);

  let buf = !Buffer.isBuffer(body) ? Buffer.from(body) : body;

  return etag(buf, opt === true || opt === "weak" ? { weak: true } : {});
}

/**
 * Check the data freshness.
 */
function isFresh(req: any, res: any): boolean {
  if (
    (res.statusCode >= 200 && res.statusCode < 300) ||
    304 === res.statusCode
  ) {
    return fresh(req.headers, {
      etag: res.getHeader("ETag"),
      "last-modified": res.getHeader("Last-Modified"),
    });
  }
  return false;
}

/**
 * 是否满足匹配条件
 */
function match(text: string, pattern: string) {
  // Simple patterns
  if (pattern.indexOf("?") == -1) {
    // Exact match (eg. "prefix.event")
    const firstStarPosition = pattern.indexOf("*");
    if (firstStarPosition == -1) {
      return pattern === text;
    }

    // Eg. "prefix**"
    const len = pattern.length;
    if (len > 2 && pattern.endsWith("**") && firstStarPosition > len - 3) {
      pattern = pattern.substring(0, len - 2);
      return text.startsWith(pattern);
    }

    // Eg. "prefix*"
    if (len > 1 && pattern.endsWith("*") && firstStarPosition > len - 2) {
      pattern = pattern.substring(0, len - 1);
      if (text.startsWith(pattern)) {
        return text.indexOf(".", len) == -1;
      }
      return false;
    }

    // Accept simple text, without point character (*)
    if (len == 1 && firstStarPosition == 0) {
      return text.indexOf(".") == -1;
    }

    // Accept all inputs (**)
    if (len == 2 && firstStarPosition == 0 && pattern.lastIndexOf("*") == 1) {
      return true;
    }
  }

  // Regex (eg. "prefix.ab?cd.*.foo")
  const origPattern = pattern;
  let regex = RegexCache.get(origPattern);
  if (regex == null) {
    if (pattern.startsWith("$")) {
      pattern = "\\" + pattern;
    }
    pattern = pattern.replace(/\?/g, ".");
    pattern = pattern.replace(/\*\*/g, "§§§");
    pattern = pattern.replace(/\*/g, "[^\\.]*");
    pattern = pattern.replace(/§§§/g, ".*");

    pattern = "^" + pattern + "$";

    // eslint-disable-next-line security/detect-non-literal-regexp
    regex = new RegExp(pattern, "");
    RegexCache.set(origPattern, regex);
  }

  return regex.test(text);
}

export {
  removeTrailingSlashes,
  addSlashes,
  normalizePath,
  decodeParam,
  compose,
  composeThen,
  generateETag,
  isFresh,
  match,
};
