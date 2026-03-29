import { postRouter } from "@/server/api/routers/post";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { projectRouter } from "./routers/project";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */

export const appRouter = createTRPCRouter({
  post: postRouter,
  // projectRouter is not included in appRouter (client-safe)
});

// Server-only router (includes protected procedures)
export const serverAppRouter = createTRPCRouter({
  post: postRouter,
  project: projectRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export type ServerAppRouter = typeof serverAppRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(serverAppRouter);
