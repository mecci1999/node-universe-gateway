export default class MemoryStore {
    hits: Map<any, any>;
    resetTime: number;
    timer: any;
    constructor(clearPeriod: number);
    inc(key: string): number;
    reset(): void;
}
