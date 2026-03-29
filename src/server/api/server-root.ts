import { postRouter } from "@/server/api/routers/post";
import { projectRouter } from "./routers/project";
import { createTRPCRouter } from "@/server/api/trpc";
import { createCallerFactory } from "@/server/api/trpc-server";

export const serverAppRouter = createTRPCRouter({
  post: postRouter,
  project: projectRouter,
});

export type ServerAppRouter = typeof serverAppRouter;

export const createCaller = createCallerFactory(serverAppRouter);
