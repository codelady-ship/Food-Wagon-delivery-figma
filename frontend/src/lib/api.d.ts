import { ApiError } from "./errors.js";
export { ApiError };
export type ApiOptions = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; form?: FormData };
/** Calls the Express API, or the bundled demo API when the live one is not configured or unreachable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function api(path: string, options?: ApiOptions): Promise<any>;
export function apiMode(): Promise<"live" | "demo">;
