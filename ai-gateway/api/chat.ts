import { handleChat, handleOptions } from "../src/http.js";

export const config = { maxDuration: 60 };

export const POST = (request: Request) => handleChat(request, process.env);
export const OPTIONS = (request: Request) => handleOptions(request, process.env);
