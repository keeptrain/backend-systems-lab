import { Type as t } from "@sinclair/typebox";
import { AssertError, Value } from "@sinclair/typebox/value";

/**
 * Validated environment. The schema and helpers live only inside this
 * initializer, so nothing stays in memory after startup.
 */
export const ENV = (() => {
  const schema = t.Object({
    NODE_ENV: t.Union(
      [t.Literal("development"), t.Literal("test"), t.Literal("production")],
      { default: "development" },
    ),
    PORT: t.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  });

  const nodeEnv = process.env.NODE_ENV?.trim();
  const port = process.env.PORT?.trim();

  const value: unknown = Value.Default(schema, {
    NODE_ENV: nodeEnv === "" ? undefined : nodeEnv,
    PORT: port === undefined || port === "" ? undefined : Number(port),
  });

  try {
    Value.Assert(schema, value);
    return value;
  } catch (error) {
    if (error instanceof AssertError) {
      const details = [...error.Errors()]
        .map((issue) => `- ${issue.path.slice(1)}: ${issue.message}`)
        .join("\n");

      throw new Error(`Invalid environment variables:\n${details}`);
    }

    throw error;
  }
})();

export type Env = typeof ENV;
