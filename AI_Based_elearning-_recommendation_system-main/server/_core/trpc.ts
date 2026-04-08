import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ZodError } from "zod";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    let details: unknown = undefined;
    if (error.code === "BAD_REQUEST" && error.cause instanceof ZodError) {
      const firstIssue = error.cause.issues[0]?.message ?? "Invalid input";
      details = error.cause.issues;
      return {
        ...shape,
        message: `Validation failed: ${firstIssue}`,
        error: {
          code: shape.code,
          message: `Validation failed: ${firstIssue}`,
          details,
        },
      };
    }
    return {
      ...shape,
      error: {
        code: shape.code,
        message: shape.message,
        details: error.cause ?? undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const requireUser = t.middleware(async opts => {
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

export const requireAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const adminProcedure = t.procedure.use(requireAdmin);
