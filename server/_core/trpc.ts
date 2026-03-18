import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { applyRateLimit, getClientIdentity, type RateLimitRule } from "./rateLimit";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const rateLimitMiddleware = (scope: string, rule: RateLimitRule) =>
  t.middleware(async ({ ctx, next }) => {
    const identity = getClientIdentity(
      ctx.req.headers,
      ctx.req.socket?.remoteAddress,
      ctx.user?.id ?? null
    );

    const result = applyRateLimit(scope, identity, rule);
    ctx.res.setHeader("X-RateLimit-Limit", String(result.limit));
    ctx.res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    ctx.res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      ctx.res.setHeader("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again shortly.",
      });
    }

    return next();
  });

export const publicRateLimitedProcedure = (scope: string, rule: RateLimitRule) =>
  publicProcedure.use(rateLimitMiddleware(scope, rule));

export const protectedRateLimitedProcedure = (scope: string, rule: RateLimitRule) =>
  protectedProcedure.use(rateLimitMiddleware(scope, rule));

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
