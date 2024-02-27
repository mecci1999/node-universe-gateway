import Universe from 'node-universe';
import queryString from 'qs';
import _ from 'lodash';
import etag from 'etag';
import fresh from 'fresh';
import http2 from 'http2';
import http from 'http';
import https from 'https';
import os from 'os';
import { pathToRegexp } from 'path-to-regexp';
import kleur from 'kleur';
import Busboy from '@fastify/busboy';
import isStream from 'isstream';
import bodyParser from 'body-parser';
import serveStatic from 'serve-static';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const ERR_UNABLE_DECODE_PARAM = "UNABLE_DECODE_PARAM";
const ERR_ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED";
const UniverseError = Universe.Errors.UniverseError;
const StarClientError = Universe.Errors.StarClientError;
class ForbiddenError extends UniverseError {
    constructor(type, data) {
        super("Forbidden", 403, type, data);
    }
}
class BadRequestError extends UniverseError {
    constructor(type, data) {
        super("Bad request", 400, type, data);
    }
}
class NotFoundError extends UniverseError {
    constructor(type, data) {
        super("Not found", 404, type || "NOT_FOUND", data);
    }
}
class PayloadTooLarge extends StarClientError {
    constructor(data) {
        super("Payload too large", 413, "PAYLOAD_TOO_LARGE", data);
    }
}
class RateLimitExceeded extends StarClientError {
    constructor(type, data) {
        super("Rate limit exceeded", 429, type, data);
    }
}
class ServiceUnavailableError extends UniverseError {
    constructor(type, data) {
        super("Service unavailable", 503, type, data);
    }
}

const RegexCache = new Map();
function decodeParam(param) {
    try {
        return decodeURIComponent(param);
    }
    catch (error) {
        throw new BadRequestError(ERR_UNABLE_DECODE_PARAM, { param });
    }
}
function removeTrailingSlashes(s) {
    if (s.startsWith("/"))
        s = s.slice(1);
    if (s.endsWith("/"))
        s = s.slice(0, -1);
    return s;
}
function addSlashes(s) {
    return (s.startsWith("/") ? "" : "/") + s + (s.endsWith("/") ? "" : "/");
}
function normalizePath(s) {
    return s.replace(/\/{2,}/g, "/");
}
function compose(...mws) {
    const self = this;
    return (req, res, done) => {
        const next = (i, err) => {
            if (i >= mws.length) {
                if (_.isFunction(done))
                    return done.call(self, err);
                return;
            }
            if (err) {
                if (mws[i].length == 4)
                    mws[i].call(self, err, req, res, (err) => next(i + 1, err));
                else
                    next(i + 1, err);
            }
            else {
                if (mws[i].length < 4)
                    mws[i].call(self, req, res, (err) => next(i + 1, err));
                else
                    next(i + 1);
            }
        };
        return next(0);
    };
}
function composeThen(req, res, ...mws) {
    return new Promise((resolve, reject) => {
        compose.call(this, ...mws)(req, res, (err) => {
            if (err) {
                if (err instanceof UniverseError)
                    return reject(err);
                if (err instanceof Error)
                    return reject(new UniverseError(err.message, err.code || err.status, err.type));
                return reject(new UniverseError(err));
            }
            resolve(true);
        });
    });
}
function generateETag(body, opt) {
    if (_.isFunction(opt))
        return opt.call(this, body);
    let buf = !Buffer.isBuffer(body) ? Buffer.from(body) : body;
    return etag(buf, opt === true || opt === "weak" ? { weak: true } : {});
}
function isFresh(req, res) {
    if ((res.statusCode >= 200 && res.statusCode < 300) ||
        304 === res.statusCode) {
        return fresh(req.headers, {
            etag: res.getHeader("ETag"),
            "last-modified": res.getHeader("Last-Modified"),
        });
    }
    return false;
}
function match(text, pattern) {
    if (pattern.indexOf("?") == -1) {
        const firstStarPosition = pattern.indexOf("*");
        if (firstStarPosition == -1) {
            return pattern === text;
        }
        const len = pattern.length;
        if (len > 2 && pattern.endsWith("**") && firstStarPosition > len - 3) {
            pattern = pattern.substring(0, len - 2);
            return text.startsWith(pattern);
        }
        if (len > 1 && pattern.endsWith("*") && firstStarPosition > len - 2) {
            pattern = pattern.substring(0, len - 1);
            if (text.startsWith(pattern)) {
                return text.indexOf(".", len) == -1;
            }
            return false;
        }
        if (len == 1 && firstStarPosition == 0) {
            return text.indexOf(".") == -1;
        }
        if (len == 2 && firstStarPosition == 0 && pattern.lastIndexOf("*") == 1) {
            return true;
        }
    }
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
        regex = new RegExp(pattern, "");
        RegexCache.set(origPattern, regex);
    }
    return regex.test(text);
}

class Alias {
    constructor(service, route, opts, action) {
        this.fullPath = "";
        this.keys = [];
        this.service = service;
        this.route = route;
        this.type = "call";
        this.method = "*";
        this.path = null;
        this.handler = null;
        this.action = null;
        if (_.isString(opts)) {
            if (opts.indexOf(" ") !== -1) {
                const p = opts.split(/\s+/);
                this.method = p[0];
                this.path = p[1];
            }
            else {
                this.path = opts;
            }
        }
        else if (_.isObject(opts)) {
            Object.assign(this, _.cloneDeep(opts));
        }
        if (_.isString(action)) {
            if (action.indexOf(":") > 0) {
                const p = action.split(":");
                this.type = p[0];
                this.action = p[1];
            }
            else {
                this.action = action;
            }
        }
        else if (_.isFunction(action)) {
            this.handler = action;
            this.action = null;
        }
        else if (Array.isArray(action)) {
            const mws = _.compact(action.map((mw) => {
                if (_.isString(mw))
                    this.action = mw;
                else if (_.isFunction(mw))
                    return mw;
            }));
            this.handler = compose.call(service, ...mws);
        }
        else if (action != null) {
            Object.assign(this, _.cloneDeep(action));
        }
        this.type = this.type || "call";
        this.path = removeTrailingSlashes(this.path);
        this.fullPath = this.fullPath || addSlashes(this.route.path) + this.path;
        if (this.fullPath !== "/" && this.fullPath.endsWith("/")) {
            this.fullPath = this.fullPath.slice(0, -1);
        }
        this.keys = [];
        this.re = pathToRegexp(this.fullPath, this.keys, route.opts.pathToRegexpOptions || {});
        if (this.type == "multipart") {
            this.handler = this.multipartHandler.bind(this);
        }
    }
    match(url) {
        const m = this.re.exec(url);
        if (!m)
            return false;
        const params = {};
        let key, param;
        for (let i = 0; i < this.keys.length; i++) {
            key = this.keys[i];
            param = m[i + 1];
            if (!param)
                continue;
            params[key.name] = decodeParam(param);
            if (key.repeat)
                params[key.name] = params[key.name].split(key.delimiter);
        }
        return params;
    }
    isMethod(method) {
        return this.method === "*" || this.method === method;
    }
    printPath() {
        return `${this.method} ${this.fullPath}`;
    }
    toString() {
        return (kleur.magenta(_.padStart(this.method, 6)) +
            " " +
            kleur.cyan(this.fullPath) +
            kleur.grey(" => ") +
            (this.handler != null && this.type !== "multipart"
                ? "<Function>"
                : this.action));
    }
    multipartHandler(req, res) {
        const ctx = req.$ctx;
        ctx.meta.$multipart = {};
        const promises = [];
        let numOfFiles = 0;
        let hasField = false;
        const busboyOptions = _.defaultsDeep({ headers: req.headers }, this.busboyConfig, this.route.opts.busboyConfig);
        const busboy = new Busboy(busboyOptions);
        busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
            file.on("limit", () => {
                if (_.isFunction(busboyOptions.onFileSizeLimit)) {
                    busboyOptions.onFileSizeLimit.call(this.service, file, busboy);
                }
                file.destroy(new PayloadTooLarge({ fieldname, filename, encoding, mimetype }));
            });
            numOfFiles++;
            promises.push(ctx
                .call(this.action, file, _.defaultsDeep({}, this.route.opts.callOptions, {
                meta: {
                    fieldname: fieldname,
                    filename: filename,
                    encoding: encoding,
                    mimetype: mimetype,
                    $params: req.$params,
                },
            }))
                .catch((err) => {
                file.resume();
                busboy.emit("error", err);
                return err;
            }));
        });
        busboy.on("field", (field, value) => {
            hasField = true;
            ctx.meta.$multipart[field] = value;
        });
        busboy.on("finish", () => __awaiter(this, void 0, void 0, function* () {
            if (!busboyOptions.empty && numOfFiles == 0)
                return this.service.sendError(req, res, new StarClientError("File missing in the request", 500, ""));
            if (numOfFiles == 0 && hasField) {
                promises.push(ctx.call(this.action, {}, _.defaultsDeep({}, this.route.opts.callOptions, {
                    meta: {
                        $params: req.$params,
                    },
                })));
            }
            try {
                let data = yield this.service.Promise.all(promises);
                const fileLimit = busboyOptions.limits && busboyOptions.limits.files != null
                    ? busboyOptions.limits.files
                    : null;
                if (numOfFiles == 1 && fileLimit == 1) {
                    data = data[0];
                }
                if (this.route.onAfterCall)
                    data = yield this.route.onAfterCall.call(this, ctx, this.route, req, res, data);
                this.service.sendResponse(req, res, data, {});
            }
            catch (err) {
                this.service.sendError(req, res, err);
            }
        }));
        busboy.on("error", (err) => {
            req.unpipe(req.busboy);
            req.resume();
            this.service.sendError(req, res, err);
        });
        if (_.isFunction(busboyOptions.onPartsLimit)) {
            busboy.on("partsLimit", () => busboyOptions.onPartsLimit.call(this.service, busboy, this, this.service));
        }
        if (_.isFunction(busboyOptions.onFilesLimit)) {
            busboy.on("filesLimit", () => busboyOptions.onFilesLimit.call(this.service, busboy, this, this.service));
        }
        if (_.isFunction(busboyOptions.onFieldsLimit)) {
            busboy.on("fieldsLimit", () => busboyOptions.onFieldsLimit.call(this.service, busboy, this, this.service));
        }
        req.pipe(busboy);
    }
}

class MemoryStore {
    constructor(clearPeriod) {
        this.hits = new Map();
        this.resetTime = Date.now() + clearPeriod;
        this.timer = setInterval(() => {
            this.resetTime = Date.now() + clearPeriod;
            this.reset();
        }, clearPeriod);
        this.timer.unref();
    }
    inc(key) {
        let counter = this.hits.get(key) || 0;
        counter++;
        this.hits.set(key, counter);
        return counter;
    }
    reset() {
        this.hits.clear();
    }
}

const MAPPING_POLICY_ALL = "all";
const MAPPING_POLICY_RESTRICT = "restrict";
const ServiceNotFoundError = Universe.Errors.ServiceNotFoundError;
const StarServerError = Universe.Errors.StarServerError;
function getServiceFullname(svc) {
    if (svc.version != null && svc.settings.$noVersionPrefix !== true)
        return ((typeof svc.version == "number" ? "v" + svc.version : svc.version) +
            "." +
            svc.name);
    return svc.name;
}
const SLASH_REGEX = new RegExp(/\./g);
var UniverseWeb = {
    name: "api",
    settings: {
        port: process.env.PORT || 3000,
        ip: process.env.IP || "0.0.0.0",
        server: true,
        routes: [],
        logRequest: "info",
        logRequestParams: "debug",
        logResponse: "info",
        logResponseData: null,
        log4XXResponses: false,
        logRouteRegistration: "info",
        http2: false,
        httpServerTimeout: null,
        requestTimeout: 300000,
        optimizeOrder: true,
        rootCallOptions: null,
        debounceTime: 500,
    },
    metadata: {
        $category: "gateway",
        $description: "Official API Gateway service",
        $official: true,
        $package: {
            name: "node-universe-web",
            version: "1.0.0",
        },
    },
    actions: {
        rest: {
            visibility: "private",
            tracing: {
                tags: {
                    params: ["req.url", "req.method"],
                },
                spanName: (ctx) => `${ctx.params.req.method} ${ctx.params.req.url}`,
            },
            timeout: 0,
            handler(ctx) {
                const req = ctx.params.req;
                const res = ctx.params.res;
                req.$ctx = ctx;
                res.$ctx = ctx;
                if (ctx.requestID)
                    res.setHeader("X-Request-ID", ctx.requestID);
                if (!req.originalUrl)
                    req.originalUrl = req.url;
                let parsed = this.parseQueryString(req);
                let url = parsed.url;
                if (url.length > 1 && url.endsWith("/"))
                    url = url.slice(0, -1);
                req.parsedUrl = url;
                if (!req.query)
                    req.query = parsed.query;
                if (!this.routes || this.routes.length == 0)
                    return null;
                let method = req.method;
                if (method == "OPTIONS") {
                    method = req.headers["access-control-request-method"];
                }
                const found = this.resolveAlias(url, method);
                if (found) {
                    const route = found.alias.route;
                    req.baseUrl = route.path;
                    req.url = req.originalUrl.substring(route.path.length);
                    if (req.url.length == 0 || req.url[0] !== "/")
                        req.url = "/" + req.url;
                    return this.routeHandler(ctx, route, req, res, found);
                }
                for (let i = 0; i < this.routes.length; i++) {
                    const route = this.routes[i];
                    if (url.startsWith(route.path)) {
                        req.baseUrl = route.path;
                        req.url = req.originalUrl.substring(route.path.length);
                        if (req.url.length == 0 || req.url[0] !== "/")
                            req.url = "/" + req.url;
                        return this.routeHandler(ctx, route, req, res);
                    }
                }
                return null;
            },
        },
        listAliases: {
            rest: "GET /list-aliases",
            params: {
                grouping: { type: "boolean", optional: true, convert: true },
                withActionSchema: { type: "boolean", optional: true, convert: true },
            },
            handler(ctx) {
                const grouping = !!ctx.params.grouping;
                const withActionSchema = !!ctx.params.withActionSchema;
                const actionList = withActionSchema
                    ? this.star.registry.getActionList({})
                    : null;
                const res = [];
                this.aliases.forEach((alias) => {
                    const obj = {
                        actionName: alias.action,
                        path: alias.path,
                        fullPath: alias.fullPath,
                        methods: alias.method,
                        routePath: alias.route.path,
                    };
                    if (withActionSchema && alias.action) {
                        const actionSchema = actionList.find((item) => item.name == alias.action);
                        if (actionSchema && actionSchema.action) {
                            obj.action = _.omit(actionSchema.action, [
                                "handler",
                            ]);
                        }
                    }
                    if (grouping) {
                        const r = res.find((item) => item.route == alias.route);
                        if (r)
                            r.aliases.push(obj);
                        else {
                            res.push({
                                route: alias.route,
                                aliases: [obj],
                            });
                        }
                    }
                    else {
                        res.push(obj);
                    }
                });
                if (grouping) {
                    res.forEach((item) => {
                        item.path = item.route.path;
                        delete item.route;
                    });
                }
                return res;
            },
        },
        addRoute: {
            params: {
                route: { type: "object" },
                toBottom: { type: "boolean", optional: true, default: true },
            },
            visibility: "public",
            handler(ctx) {
                return this.addRoute(ctx.params.route, ctx.params.toBottom);
            },
        },
        removeRoute: {
            params: {
                name: { type: "string", optional: true },
                path: { type: "string", optional: true },
            },
            visibility: "public",
            handler(ctx) {
                if (ctx.params.name != null)
                    return this.removeRouteByName(ctx.params.name);
                return this.removeRoute(ctx.params.path);
            },
        },
    },
    methods: {
        createServer() {
            if (this.server)
                return;
            if (this.settings.https &&
                this.settings.https.key &&
                this.settings.https.cert) {
                this.server = this.settings.http2
                    ? http2.createSecureServer(this.settings.https, this.httpHandler)
                    : https.createServer(this.settings.https, this.httpHandler);
                this.isHTTPS = true;
            }
            else {
                this.server = this.settings.http2
                    ? http2.createServer(this.httpHandler)
                    : http.createServer(this.httpHandler);
                this.isHTTPS = false;
            }
            if (this.settings.httpServerTimeout) {
                this.logger.debug("Override default http(s) server timeout:", this.settings.httpServerTimeout);
                this.server.setTimeout(this.settings.httpServerTimeout);
            }
            this.server.requestTimeout = this.settings.requestTimeout;
            this.logger.debug("Setting http(s) server request timeout to:", this.settings.requestTimeout);
        },
        errorHandler(req, res, err) {
            if (this.settings.log4XXResponses ||
                (err && !_.inRange(err.code, 400, 500))) {
                this.logger.error("   Request error!", err.name, ":", err.message, "\n", err.stack, "\nData:", err.data);
            }
            this.sendError(req, res, err);
        },
        corsHandler(settings, req, res) {
            if (settings.cors) {
                this.writeCorsHeaders(settings, req, res, true);
                if (req.method == "OPTIONS" &&
                    req.headers["access-control-request-method"]) {
                    res.writeHead(204, {
                        "Content-Length": "0",
                    });
                    res.end();
                    if (settings.logging) {
                        this.logResponse(req, res);
                    }
                    return true;
                }
            }
            return false;
        },
        httpHandler(req, res, next) {
            return __awaiter(this, void 0, void 0, function* () {
                req.$startTime = process.hrtime();
                req.$service = this;
                req.$next = next;
                res.$service = this;
                res.locals = res.locals || {};
                let requestID = req.headers["x-request-id"];
                if (req.headers["x-correlation-id"])
                    requestID = req.headers["x-correlation-id"];
                let options = { requestID };
                if (this.settings.rootCallOptions) {
                    if (_.isPlainObject(this.settings.rootCallOptions)) {
                        Object.assign(options, this.settings.rootCallOptions);
                    }
                    else if (_.isFunction(this.settings.rootCallOptions)) {
                        this.settings.rootCallOptions.call(this, options, req, res);
                    }
                }
                try {
                    const result = yield this.actions.rest({ req, res }, options);
                    if (result == null) {
                        const shouldBreak = this.corsHandler(this.settings, req, res);
                        if (shouldBreak) {
                            return;
                        }
                        if (this.serve) {
                            this.serve(req, res, (err) => {
                                this.logger.debug(err);
                                this.send404(req, res);
                            });
                            return;
                        }
                        this.send404(req, res);
                    }
                }
                catch (err) {
                    this.errorHandler(req, res, err);
                }
            });
        },
        routeHandler(ctx, route, req, res, foundAlias) {
            req.$route = route;
            res.$route = route;
            this.logRequest(req);
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                res.once("finish", () => resolve(true));
                res.once("close", () => resolve(true));
                res.once("error", (err) => reject(err));
                try {
                    yield composeThen.call(this, req, res, ...route.middlewares);
                    let params = {};
                    const shouldBreak = this.corsHandler(route, req, res);
                    if (shouldBreak) {
                        return resolve(true);
                    }
                    if (route.opts.mergeParams === false) {
                        params = { body: req.body, query: req.query };
                    }
                    else {
                        const body = _.isObject(req.body) ? req.body : {};
                        Object.assign(params, body, req.query);
                    }
                    req.$params = params;
                    let urlPath = req.parsedUrl.slice(route.path.length);
                    if (urlPath.startsWith("/"))
                        urlPath = urlPath.slice(1);
                    urlPath = urlPath.replace(this._isscRe, "$");
                    let action = urlPath;
                    if (foundAlias) {
                        const alias = foundAlias.alias;
                        this.logger.debug("  Alias:", alias.toString());
                        if (route.opts.mergeParams === false) {
                            params.params = foundAlias.params;
                        }
                        else {
                            Object.assign(params, foundAlias.params);
                        }
                        req.$alias = alias;
                        return resolve(yield this.aliasHandler(req, res, alias));
                    }
                    else if (route.mappingPolicy == MAPPING_POLICY_RESTRICT) {
                        return resolve(null);
                    }
                    if (!action)
                        return resolve(null);
                    action = action.replace(/\//g, ".");
                    if (route.opts.camelCaseNames) {
                        action = action.split(".").map(_.camelCase).join(".");
                    }
                    const result = yield this.aliasHandler(req, res, {
                        action,
                        _notDefined: true,
                    });
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
            }));
        },
        aliasHandler(req, res, alias) {
            return __awaiter(this, void 0, void 0, function* () {
                const route = req.$route;
                const ctx = req.$ctx;
                if (alias.action && route.hasWhitelist) {
                    if (!this.checkWhitelist(route, alias.action)) {
                        this.logger.debug(`  The '${alias.action}' action is not in the whitelist!`);
                        throw new ServiceNotFoundError({ action: alias.action });
                    }
                }
                if (route.rateLimit) {
                    const opts = route.rateLimit;
                    const store = route.rateLimit.store;
                    const key = opts.key(req);
                    if (key) {
                        const remaining = opts.limit - (yield store.inc(key));
                        if (opts.headers) {
                            res.setHeader("X-Rate-Limit-Limit", opts.limit);
                            res.setHeader("X-Rate-Limit-Remaining", Math.max(0, remaining));
                            res.setHeader("X-Rate-Limit-Reset", store.resetTime);
                        }
                        if (remaining < 0) {
                            throw new RateLimitExceeded();
                        }
                    }
                }
                if (alias.action) {
                    const endpoint = this.star.findNextActionEndpoint(alias.action, route.callOptions, ctx);
                    if (endpoint instanceof Error) {
                        if (!alias._notDefined && endpoint instanceof ServiceNotFoundError) {
                            throw new ServiceUnavailableError();
                        }
                        throw endpoint;
                    }
                    if (endpoint.action.visibility != null &&
                        endpoint.action.visibility != "published") {
                        throw new ServiceNotFoundError({ action: alias.action });
                    }
                    req.$endpoint = endpoint;
                    req.$action = endpoint.action;
                }
                if (route.onBeforeCall) {
                    yield route.onBeforeCall.call(this, ctx, route, req, res, alias);
                }
                if (route.authentication) {
                    const user = yield route.authentication.call(this, ctx, route, req, res, alias);
                    if (user) {
                        this.logger.debug("Authenticated user", user);
                        ctx.meta.user = user;
                    }
                    else {
                        this.logger.debug("Anonymous user");
                        ctx.meta.user = null;
                    }
                }
                if (route.authorization) {
                    yield route.authorization.call(this, ctx, route, req, res, alias);
                }
                if (_.isFunction(alias.handler)) {
                    if (route.logging &&
                        this.settings.logRequest &&
                        this.settings.logRequest in this.logger)
                        this.logger[this.settings.logRequest](`   Call custom function in '${alias.toString()}' alias`);
                    yield new Promise((resolve, reject) => {
                        alias.handler.call(this, req, res, (err) => {
                            if (err)
                                reject(err);
                            else
                                resolve(true);
                        });
                    });
                    if (alias.action)
                        return this.callAction(route, alias.action, req, res, alias.type == "stream" ? req : req.$params);
                    else
                        throw new StarServerError("No alias handler", 500, "NO_ALIAS_HANDLER", { path: req.originalUrl, alias: _.pick(alias, ["method", "path"]) });
                }
                else if (alias.action) {
                    return this.callAction(route, alias.action, req, res, alias.type == "stream" ? req : req.$params);
                }
            });
        },
        callAction(route, actionName, req, res, params) {
            return __awaiter(this, void 0, void 0, function* () {
                const ctx = req.$ctx;
                try {
                    if (route.logging) {
                        if (this.settings.logRequest &&
                            this.settings.logRequest in this.logger)
                            this.logger[this.settings.logRequest](`   Call '${actionName}' action`);
                        if (this.settings.logRequestParams &&
                            this.settings.logRequestParams in this.logger)
                            this.logger[this.settings.logRequestParams]("   Params:", params);
                    }
                    if (req.$alias && req.$alias.passReqResToParams) {
                        params.$req = req;
                        params.$res = res;
                    }
                    const opts = route.callOptions ? Object.assign({}, route.callOptions) : {};
                    if (params && params.$params) {
                        if (!opts.meta)
                            opts.meta = { $params: params.$params };
                        else
                            opts.meta.$params = params.$params;
                    }
                    let data = yield ctx.call(req.$endpoint, params, opts);
                    if (route.onAfterCall)
                        data = yield route.onAfterCall.call(this, ctx, route, req, res, data);
                    this.sendResponse(req, res, data, req.$endpoint.action);
                    if (route.logging)
                        this.logResponse(req, res, data);
                    return true;
                }
                catch (err) {
                    if (!err)
                        return;
                    throw err;
                }
            });
        },
        encodeResponse(req, res, data) {
            return JSON.stringify(data);
        },
        sendResponse(req, res, data, action) {
            const ctx = req.$ctx;
            const route = req.$route;
            if (res.headersSent) {
                this.logger.warn("Headers have already sent.", {
                    url: req.url,
                    action,
                });
                return;
            }
            if (!res.statusCode)
                res.statusCode = 200;
            if (ctx.meta.$statusCode) {
                res.statusCode = ctx.meta.$statusCode;
            }
            if (ctx.meta.$statusMessage) {
                res.statusMessage = ctx.meta.$statusMessage;
            }
            if (res.statusCode == 201 ||
                (res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.statusCode !== 304)) {
                const location = ctx.meta.$location;
                if (!location) {
                    this.logger.warn(`The 'ctx.meta.$location' is missing for status code '${res.statusCode}'!`);
                }
                else {
                    res.setHeader("Location", location);
                }
            }
            let responseType;
            if (action && action.responseType) {
                responseType = action.responseType;
            }
            if (action && action.responseHeaders) {
                Object.keys(action.responseHeaders).forEach((key) => {
                    res.setHeader(key, action.responseHeaders[key]);
                    if (key == "Content-Type" && !responseType)
                        responseType = action.responseHeaders[key];
                });
            }
            if (ctx.meta.$responseType) {
                responseType = ctx.meta.$responseType;
            }
            if (ctx.meta.$responseHeaders) {
                Object.keys(ctx.meta.$responseHeaders).forEach((key) => {
                    if (key == "Content-Type" && !responseType)
                        responseType = ctx.meta.$responseHeaders[key];
                    else
                        res.setHeader(key, ctx.meta.$responseHeaders[key]);
                });
            }
            if (data == null)
                return res.end();
            let chunk;
            if (Buffer.isBuffer(data)) {
                res.setHeader("Content-Type", responseType || "application/octet-stream");
                res.setHeader("Content-Length", data.length);
                chunk = data;
            }
            else if (_.isObject(data) && data.type == "Buffer") {
                const buf = Buffer.from(data);
                res.setHeader("Content-Type", responseType || "application/octet-stream");
                res.setHeader("Content-Length", buf.length);
                chunk = buf;
            }
            else if (isStream.isReadable(data)) {
                res.setHeader("Content-Type", responseType || "application/octet-stream");
                chunk = data;
            }
            else if (_.isObject(data) || Array.isArray(data)) {
                res.setHeader("Content-Type", responseType || "application/json; charset=utf-8");
                chunk = this.encodeResponse(req, res, data);
            }
            else {
                if (!responseType) {
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
                    chunk = this.encodeResponse(req, res, data);
                }
                else {
                    res.setHeader("Content-Type", responseType);
                    if (_.isString(data))
                        chunk = data;
                    else
                        chunk = data.toString();
                }
            }
            if (route.etag &&
                chunk &&
                !res.getHeader("ETag") &&
                !isStream.isReadable(chunk)) {
                res.setHeader("ETag", generateETag.call(this, chunk, route.etag));
            }
            if (isFresh(req, res))
                res.statusCode = 304;
            if (res.statusCode === 204 || res.statusCode === 304) {
                res.removeHeader("Content-Type");
                res.removeHeader("Content-Length");
                res.removeHeader("Transfer-Encoding");
                chunk = "";
            }
            if (req.method === "HEAD") {
                res.end();
            }
            else {
                if (isStream.isReadable(data)) {
                    data.pipe(res);
                }
                else {
                    res.end(chunk);
                }
            }
        },
        express() {
            return (req, res, next) => this.httpHandler(req, res, next);
        },
        send404(req, res) {
            if (req.$next)
                return req.$next();
            this.sendError(req, res, new NotFoundError());
        },
        sendError(req, res, err) {
            if (req.$route && _.isFunction(req.$route.onError))
                return req.$route.onError.call(this, req, res, err);
            if (_.isFunction(this.settings.onError))
                return this.settings.onError.call(this, req, res, err);
            if (req.$next)
                return req.$next(err);
            if (res.headersSent) {
                this.logger.warn("Headers have already sent", req.url, err);
                return;
            }
            if (!err || !(err instanceof Error)) {
                res.writeHead(500);
                res.end("Internal Server Error");
                this.logResponse(req, res);
                return;
            }
            if (!(err instanceof UniverseError)) {
                const e = err;
                err = new UniverseError(e.message, e.code || e.status, e.type, e.data);
                err.name = e.name;
            }
            const ctx = req.$ctx;
            let responseType = "application/json; charset=utf-8";
            if (ctx) {
                if (ctx.meta.$responseType) {
                    responseType = ctx.meta.$responseType;
                }
                if (ctx.meta.$responseHeaders) {
                    Object.keys(ctx.meta.$responseHeaders).forEach((key) => {
                        if (key === "Content-Type" && !responseType)
                            responseType = ctx.meta.$responseHeaders[key];
                        else
                            res.setHeader(key, ctx.meta.$responseHeaders[key]);
                    });
                }
            }
            res.setHeader("Content-type", responseType);
            const code = _.isNumber(err.code) && _.inRange(err.code, 400, 599) ? err.code : 500;
            res.writeHead(code);
            const errObj = this.reformatError(err, req, res);
            res.end(errObj !== undefined
                ? this.encodeResponse(req, res, errObj)
                : undefined);
            this.logResponse(req, res);
        },
        reformatError(err, req, res) {
            return _.pick(err, ["name", "message", "code", "type", "data"]);
        },
        sendRedirect(res, url, code = 302) {
            res.writeHead(code, {
                Location: url,
                "Content-Length": "0",
            });
            res.end();
        },
        parseQueryString(req) {
            let url = req.url;
            let query = {};
            const questionIdx = req.url.indexOf("?", 1);
            if (questionIdx !== -1) {
                query = queryString.parse(req.url.substring(questionIdx + 1), this.settings.qsOptions);
                url = req.url.substring(0, questionIdx);
            }
            return { query, url };
        },
        logRequest(req) {
            if (req.$route && !req.$route.logging)
                return;
            if (this.settings.logRequest &&
                this.settings.logRequest in this.logger)
                this.logger[this.settings.logRequest](`=> ${req.method} ${req.url}`);
        },
        coloringStatusCode(code) {
            if (code >= 500)
                return kleur.red().bold(code);
            if (code >= 400 && code < 500)
                return kleur.red().bold(code);
            if (code >= 300 && code < 400)
                return kleur.cyan().bold(code);
            if (code >= 200 && code < 300)
                return kleur.green().bold(code);
            return code;
        },
        logResponse(req, res, data) {
            if (req.$route && !req.$route.logging)
                return;
            let time = "";
            if (req.$startTime) {
                const diff = process.hrtime(req.$startTime);
                const duration = (diff[0] + diff[1] / 1e9) * 1000;
                if (duration > 1000)
                    time = kleur.red(`[+${Number(duration / 1000).toFixed(3)} s]`);
                else
                    time = kleur.grey(`[+${Number(duration).toFixed(3)} ms]`);
            }
            if (this.settings.logResponse &&
                this.settings.logResponse in this.logger)
                this.logger[this.settings.logResponse](`<= ${this.coloringStatusCode(res.statusCode)} ${req.method} ${kleur.bold(req.originalUrl)} ${time}`);
            if (this.settings.logResponseData &&
                this.settings.logResponseData in this.logger) {
                this.logger[this.settings.logResponseData]("  Data:", data);
            }
        },
        checkOrigin(origin, settings) {
            if (_.isString(settings)) {
                if (settings.indexOf(origin) !== -1)
                    return true;
                if (settings.indexOf("*") !== -1) {
                    const wildcard = new RegExp(`^${_.escapeRegExp(settings).replace(/\\\*/g, ".*").replace(/\\\?/g, ".")}$`);
                    return origin.match(wildcard);
                }
            }
            else if (_.isFunction(settings)) {
                return settings.call(this, origin);
            }
            else if (Array.isArray(settings)) {
                for (let i = 0; i < settings.length; i++) {
                    if (this.checkOrigin(origin, settings[i])) {
                        return true;
                    }
                }
            }
            return false;
        },
        writeCorsHeaders(route, req, res, isPreFlight) {
            if (!route.cors)
                return;
            const origin = req.headers["origin"];
            if (!origin)
                return;
            if (!route.cors.origin || route.cors.origin === "*") {
                res.setHeader("Access-Control-Allow-Origin", "*");
            }
            else if (this.checkOrigin(origin, route.cors.origin)) {
                res.setHeader("Access-Control-Allow-Origin", origin);
                res.setHeader("Vary", "Origin");
            }
            else {
                throw new ForbiddenError(ERR_ORIGIN_NOT_ALLOWED);
            }
            if (route.cors.credentials === true) {
                res.setHeader("Access-Control-Allow-Credentials", "true");
            }
            if (_.isString(route.cors.exposedHeaders)) {
                res.setHeader("Access-Control-Expose-Headers", route.cors.exposedHeaders);
            }
            else if (Array.isArray(route.cors.exposedHeaders)) {
                res.setHeader("Access-Control-Expose-Headers", route.cors.exposedHeaders.join(", "));
            }
            if (isPreFlight) {
                if (_.isString(route.cors.allowedHeaders)) {
                    res.setHeader("Access-Control-Allow-Headers", route.cors.allowedHeaders);
                }
                else if (Array.isArray(route.cors.allowedHeaders)) {
                    res.setHeader("Access-Control-Allow-Headers", route.cors.allowedHeaders.join(", "));
                }
                else {
                    const allowedHeaders = req.headers["access-control-request-headers"];
                    if (allowedHeaders) {
                        res.setHeader("Vary", "Access-Control-Request-Headers");
                        res.setHeader("Access-Control-Allow-Headers", allowedHeaders);
                    }
                }
                if (_.isString(route.cors.methods)) {
                    res.setHeader("Access-Control-Allow-Methods", route.cors.methods);
                }
                else if (Array.isArray(route.cors.methods)) {
                    res.setHeader("Access-Control-Allow-Methods", route.cors.methods.join(", "));
                }
                if (route.cors.maxAge) {
                    res.setHeader("Access-Control-Max-Age", route.cors.maxAge.toString());
                }
            }
        },
        checkWhitelist(route, action) {
            return (route.whitelist.find((mask) => {
                if (_.isString(mask))
                    return match(action, mask);
                else if (_.isRegExp(mask))
                    return mask.test(action);
            }) != null);
        },
        resolveAlias(url, method = "GET") {
            for (let i = 0; i < this.aliases.length; i++) {
                const alias = this.aliases[i];
                if (alias.isMethod(method)) {
                    const params = alias.match(url);
                    if (params) {
                        return { alias, params };
                    }
                }
            }
            return false;
        },
        addRoute(opts, toBottom = true) {
            const route = this.createRoute(opts);
            const idx = this.routes.findIndex((r) => this.isEqualRoutes(r, route));
            if (idx !== -1) {
                this.routes[idx] = route;
            }
            else {
                if (toBottom)
                    this.routes.push(route);
                else
                    this.routes.unshift(route);
                if (this.settings.optimizeOrder)
                    this.optimizeRouteOrder();
            }
            return route;
        },
        removeRoute(path) {
            const idx = this.routes.findIndex((r) => r.opts.path == path);
            if (idx !== -1) {
                const route = this.routes[idx];
                this.aliases = this.aliases.filter((a) => a.route != route);
                this.routes.splice(idx, 1);
                return true;
            }
            return false;
        },
        removeRouteByName(name) {
            const idx = this.routes.findIndex((r) => r.opts.name == name);
            if (idx !== -1) {
                const route = this.routes[idx];
                this.aliases = this.aliases.filter((a) => a.route != route);
                this.routes.splice(idx, 1);
                return true;
            }
            return false;
        },
        optimizeRouteOrder() {
            this.routes.sort((a, b) => {
                let c = addSlashes(b.path).split("/").length -
                    addSlashes(a.path).split("/").length;
                if (c == 0) {
                    c = a.path.split(":").length - b.path.split(":").length;
                }
                return c;
            });
            this.logger.debug("Optimized path order: ", this.routes.map((r) => r.path));
        },
        createRoute(opts) {
            this.logRouteRegistration(`Register route to '${opts.path}'`);
            let route = {
                name: opts.name,
                opts,
                middlewares: [],
            };
            if (opts.authorization) {
                let fn = this.authorize;
                if (_.isString(opts.authorization))
                    fn = this[opts.authorization];
                if (!_.isFunction(fn)) {
                    this.logger.warn("Define 'authorize' method in the service to enable authorization.");
                    route.authorization = null;
                }
                else
                    route.authorization = fn;
            }
            if (opts.authentication) {
                let fn = this.authenticate;
                if (_.isString(opts.authentication))
                    fn = this[opts.authentication];
                if (!_.isFunction(fn)) {
                    this.logger.warn("Define 'authenticate' method in the service to enable authentication.");
                    route.authentication = null;
                }
                else
                    route.authentication = fn;
            }
            route.callOptions = opts.callOptions;
            if (opts.bodyParsers == null || opts.bodyParsers === true) {
                opts.bodyParsers = {
                    json: true,
                };
            }
            if (opts.bodyParsers) {
                const bps = opts.bodyParsers;
                Object.keys(bps).forEach((key) => {
                    const opts = _.isObject(bps[key]) ? bps[key] : undefined;
                    if (bps[key] !== false && key in bodyParser)
                        route.middlewares.push(bodyParser[key](opts));
                });
            }
            route.logging = opts.logging != null ? opts.logging : true;
            route.etag = opts.etag != null ? opts.etag : this.settings.etag;
            let mw = [];
            if (this.settings.use &&
                Array.isArray(this.settings.use) &&
                this.settings.use.length > 0)
                mw.push(...this.settings.use);
            if (opts.use && Array.isArray(opts.use) && opts.use.length > 0)
                mw.push(...opts.use);
            if (mw.length > 0) {
                route.middlewares.push(...mw);
                this.logRouteRegistration(`  Registered ${mw.length} middlewares.`);
            }
            if (this.settings.cors || opts.cors) {
                route.cors = Object.assign({}, {
                    origin: "*",
                    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
                }, this.settings.cors, opts.cors);
            }
            else {
                route.cors = null;
            }
            const rateLimit = opts.rateLimit || this.settings.rateLimit;
            if (rateLimit) {
                let opts = Object.assign({}, {
                    window: 60 * 1000,
                    limit: 30,
                    headers: false,
                    key: (req) => {
                        return (req.headers["x-forwarded-for"] ||
                            req.connection.remoteAddress ||
                            req.socket.remoteAddress ||
                            req.connection.socket.remoteAddress);
                    },
                }, rateLimit);
                route.rateLimit = opts;
                if (opts.StoreFactory)
                    route.rateLimit.store = new opts.StoreFactory(opts.window, opts, this.star);
                else
                    route.rateLimit.store = new MemoryStore(opts.window);
            }
            route.whitelist = opts.whitelist;
            route.hasWhitelist = Array.isArray(route.whitelist);
            if (opts.onBeforeCall)
                route.onBeforeCall = opts.onBeforeCall;
            if (opts.onAfterCall)
                route.onAfterCall = opts.onAfterCall;
            if (opts.onError)
                route.onError = opts.onError;
            const globalPath = this.settings.path && this.settings.path != "/"
                ? this.settings.path
                : "";
            route.path = addSlashes(globalPath) + (opts.path || "");
            route.path = normalizePath(route.path);
            this.createRouteAliases(route, opts.aliases);
            if (this.settings.optimizeOrder) {
                this.optimizeAliasesOrder();
            }
            route.mappingPolicy = opts.mappingPolicy;
            if (!route.mappingPolicy) {
                const hasAliases = _.isObject(opts.aliases) && Object.keys(opts.aliases).length > 0;
                route.mappingPolicy =
                    hasAliases || opts.autoAliases
                        ? MAPPING_POLICY_RESTRICT
                        : MAPPING_POLICY_ALL;
            }
            this.logRouteRegistration("");
            return route;
        },
        createRouteAliases(route, aliases) {
            this.aliases = this.aliases.filter((a) => !this.isEqualRoutes(a.route, route));
            _.forIn(aliases, (action, matchPath) => {
                if (matchPath.startsWith("REST ")) {
                    this.aliases.push(...this.generateRESTAliases(route, matchPath, action));
                }
                else {
                    this.aliases.push(this.createAlias(route, matchPath, action));
                }
            });
            if (route.opts.autoAliases) {
                this.regenerateAutoAliases(route);
            }
        },
        isEqualRoutes(routeA, routeB) {
            if (routeA.name != null && routeB.name != null) {
                return routeA.name === routeB.name;
            }
            return routeA.path === routeB.path;
        },
        generateRESTAliases(route, path, action) {
            const p = path.split(/\s+/);
            const pathName = p[1];
            const pathNameWithoutEndingSlash = pathName.endsWith("/")
                ? pathName.slice(0, -1)
                : pathName;
            const aliases = {
                list: `GET ${pathName}`,
                get: `GET ${pathNameWithoutEndingSlash}/:id`,
                create: `POST ${pathName}`,
                update: `PUT ${pathNameWithoutEndingSlash}/:id`,
                patch: `PATCH ${pathNameWithoutEndingSlash}/:id`,
                remove: `DELETE ${pathNameWithoutEndingSlash}/:id`,
            };
            let actions = ["list", "get", "create", "update", "patch", "remove"];
            if (typeof action !== "string" && (action.only || action.except)) {
                if (action.only) {
                    actions = actions.filter((item) => action.only.includes(item));
                }
                if (action.except) {
                    actions = actions.filter((item) => !action.except.includes(item));
                }
                action = action.action;
            }
            return actions.map((item) => this.createAlias(route, aliases[item], `${action}.${item}`));
        },
        regenerateAutoAliases(route) {
            this.logRouteRegistration(`♻ Generate aliases for '${route.path}' route...`);
            this.aliases = this.aliases.filter((alias) => alias.route != route || !alias._generated);
            const processedServices = new Set();
            const services = this.star.registry.getServiceList({
                withActions: true,
                grouping: true,
            });
            services.forEach((service) => {
                if (!service.settings)
                    return;
                const serviceName = service.fullName || getServiceFullname(service);
                let basePaths = [];
                if (_.isString(service.settings.rest)) {
                    basePaths = [service.settings.rest];
                }
                else if (_.isArray(service.settings.rest)) {
                    basePaths = service.settings.rest;
                }
                else {
                    basePaths = [serviceName.replace(SLASH_REGEX, "/")];
                }
                if (processedServices.has(serviceName))
                    return;
                for (let basePath of basePaths) {
                    basePath = addSlashes(_.isString(basePath)
                        ? basePath
                        : serviceName.replace(SLASH_REGEX, "/"));
                    _.forIn(service.actions, (action) => {
                        if (action.rest) {
                            if (action.visibility != null && action.visibility != "published")
                                return;
                            if (route.hasWhitelist &&
                                !this.checkWhitelist(route, action.name))
                                return;
                            let restRoutes = [];
                            if (!_.isArray(action.rest)) {
                                restRoutes = [action.rest];
                            }
                            else {
                                restRoutes = action.rest;
                            }
                            for (let restRoute of restRoutes) {
                                let alias = null;
                                if (_.isString(restRoute)) {
                                    alias = this.parseActionRestString(restRoute, basePath);
                                }
                                else if (_.isObject(restRoute)) {
                                    alias = this.parseActionRestObject(restRoute, action.rawName, basePath);
                                }
                                if (alias) {
                                    alias.path = removeTrailingSlashes(normalizePath(alias.path));
                                    alias._generated = true;
                                    this.aliases.push(this.createAlias(route, alias, action.name));
                                }
                            }
                        }
                        processedServices.add(serviceName);
                    });
                }
            });
            if (this.settings.optimizeOrder) {
                this.optimizeAliasesOrder();
            }
        },
        parseActionRestString(restRoute, basePath) {
            if (restRoute.indexOf(" ") !== -1) {
                const p = restRoute.split(/\s+/);
                return {
                    method: p[0],
                    path: basePath + p[1],
                };
            }
            return {
                method: "*",
                path: basePath + restRoute,
            };
        },
        parseActionRestObject(restRoute, rawName, basePath) {
            return Object.assign({}, restRoute, {
                method: restRoute.method || "*",
                path: (restRoute.basePath ? restRoute.basePath : basePath) +
                    (restRoute.path ? restRoute.path : rawName),
            });
        },
        optimizeAliasesOrder() {
            this.aliases.sort((a, b) => {
                let c = addSlashes(b.path).split("/").length -
                    addSlashes(a.path).split("/").length;
                if (c == 0) {
                    c = a.path.split(":").length - b.path.split(":").length;
                }
                if (c == 0) {
                    c = a.path.localeCompare(b.path);
                }
                return c;
            });
        },
        createAlias(route, path, action) {
            const alias = new Alias(this, route, path, action);
            this.logRouteRegistration("  " + alias.toString());
            return alias;
        },
        logRouteRegistration(message) {
            if (this.settings.logRouteRegistration &&
                this.settings.logRouteRegistration in this.logger)
                this.logger[this.settings.logRouteRegistration](message);
        },
    },
    events: {
        "$services.changed"() {
            this.regenerateAllAutoAliases();
        },
    },
    created() {
        if (this.settings.server !== false) {
            if (_.isObject(this.settings.server)) {
                this.server = this.settings.server;
            }
            else {
                this.createServer();
            }
            this.server.on("error", (err) => {
                this.logger.error("Server error", err);
            });
            this.logger.info("API Gateway server created.");
        }
        const specChar = this.settings.internalServiceSpecialChar != null
            ? this.settings.internalServiceSpecialChar
            : "~";
        this._isscRe = new RegExp(specChar);
        if (this.settings.assets) {
            const opts = this.settings.assets.options || {};
            this.serve = serveStatic(this.settings.assets.folder, opts);
        }
        this.aliases = [];
        if (Array.isArray(this.settings.routes) &&
            this.settings.routes.length == 0) {
            this.settings.routes = [
                {
                    path: "/",
                },
            ];
        }
        this.routes = [];
        if (Array.isArray(this.settings.routes))
            this.settings.routes.forEach((route) => this.addRoute(route));
        const debounceTime = this.settings.debounceTime > 0
            ? parseInt(this.settings.debounceTime)
            : 500;
        this.regenerateAllAutoAliases = _.debounce(() => {
            this.routes.forEach((route) => route.opts.autoAliases && this.regenerateAutoAliases(route));
            this.star.broadcast("$api.aliases.regenerated");
        }, debounceTime);
    },
    started() {
        if (this.settings.server === false)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.server.listen(this.settings.port, this.settings.ip, (err) => {
                if (err)
                    return reject(err);
                const addr = this.server.address();
                const listenAddr = addr.address == "0.0.0.0" && os.platform() == "win32"
                    ? "localhost"
                    : addr.address;
                this.logger.info(`API Gateway listening on ${this.isHTTPS ? "https" : "http"}://${listenAddr}:${addr.port}`);
                resolve(true);
            });
        });
    },
    stopped() {
        if (this.settings.server !== false && this.server.listening) {
            return new Promise((resolve, reject) => {
                this.server.close((err) => {
                    if (err)
                        return reject(err);
                    this.logger.info("API Gateway stopped!");
                    resolve(true);
                });
            });
        }
        return Promise.resolve();
    },
    bodyParser,
    serveStatic,
    Errors: require("./errors"),
    RateLimitStores: {
        MemoryStore: require("./memory-store"),
    },
};

export { UniverseWeb as default };
