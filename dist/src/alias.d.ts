import { Route } from "./typings";
export default class Alias {
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
