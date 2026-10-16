import { route, json } from "@/lib/api";

export const GET = route(async (user) => json(user));
