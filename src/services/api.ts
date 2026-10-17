/** All operational reads and writes go to the supplied FastAPI. No parallel database. */
import { ApiClient } from "./client";
import { config } from "./config";
export * from "./client";
export const api = new ApiClient(config.apiBase);
