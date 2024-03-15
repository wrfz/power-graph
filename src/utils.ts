import { DateTime, Duration } from "luxon";

export function isNumber(value?: string | number): boolean {
    return (value != null && value !== '' && !isNaN(Number(value.toString())));
}

export function toNumber(value: string | null, defaultValue: number): number {
    return value != null && isNumber(value) ? +value : defaultValue;
}

export function isObject(item: any) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target: any, ...sources: any) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}
