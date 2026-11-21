import { handleOptions, handleStatus } from "../src/http.js";

export const config = { maxDuration: 30 };

export const GET = (request: Request) => handleStatus(request, process.env);
export const OPTIONS = (request: Request) => handleOptions(request, process.env);
