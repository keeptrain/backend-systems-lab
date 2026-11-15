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
    LOG_LEVEL: t.Union(
      [
        t.Literal("fatal"),
        t.Literal("error"),
        t.Literal("warn"),
        t.Literal("info"),
        t.Literal("debug"),
        t.Literal("trace"),
        t.Literal("silent"),
      ],
      { default: "info" },
    ),
    LOG_FILE: t.Optional(t.String({ minLength: 1 })),
  });

  const nodeEnv = process.env.NODE_ENV?.trim();
  const port = process.env.PORT?.trim();
  const logLevel = process.env.LOG_LEVEL?.trim();
  const logFile = process.env.LOG_FILE?.trim();

  const resolvedNodeEnv =
    nodeEnv === undefined || nodeEnv === "" ? "development" : nodeEnv;
  const defaultLogLevel =
    resolvedNodeEnv === "production"
      ? "info"
      : resolvedNodeEnv === "test"
        ? "silent"
        : "debug";

  const value: unknown = Value.Default(schema, {
    NODE_ENV: nodeEnv === "" ? undefined : nodeEnv,
    PORT: port === undefined || port === "" ? undefined : Number(port),
    LOG_LEVEL:
      logLevel === undefined || logLevel === "" ? defaultLogLevel : logLevel,
    LOG_FILE: logFile === undefined || logFile === "" ? undefined : logFile,
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
