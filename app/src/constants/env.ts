import { type Static, Type as t } from "@sinclair/typebox";
import { AssertError, Value } from "@sinclair/typebox/value";

/**
 * Single source of truth for every environment variable the app reads.
 * Add new variables here so both runtime validation and the `Env` type
 * stay in sync.
 */
export const EnvSchema = t.Object({
  NODE_ENV: t.Union(
    [t.Literal("development"), t.Literal("test"), t.Literal("production")],
    { default: "development" },
  ),
  PORT: t.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
});

export type Env = Static<typeof EnvSchema>;

type RawEnv = Record<string, string | undefined>;

/**
 * Normalize raw string values before handing them to TypeBox: trim blanks,
 * apply defaults through `undefined`, and convert `PORT` with `Number`.
 * Non-integers become `NaN` so TypeBox rejects them instead of letting its
 * converter silently truncate a value like `"3000.5"` into `3000`.
 */
function toSchemaInput(source: RawEnv) {
  const nodeEnv = source.NODE_ENV?.trim();
  const port = source.PORT?.trim();

  return {
    NODE_ENV: nodeEnv === "" ? undefined : nodeEnv,
    PORT: toPort(port),
  };
}

function toPort(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const port = Number(value);
  return Number.isInteger(port) ? port : Number.NaN;
}

function formatEnvError(error: AssertError): string {
  const details = [...error.Errors()]
    .map((issue) => `- ${issue.path.slice(1)}: ${issue.message}`)
    .join("\n");

  return `Invalid environment variables:\n${details}`;
}

/**
 * Validate and coerce raw values into a typed `Env`.
 * Throws before the app starts when a value is missing or invalid.
 */
export function parseEnv(source: RawEnv): Env {
  try {
    return Value.Parse(EnvSchema, toSchemaInput(source));
  } catch (error) {
    if (error instanceof AssertError) {
      throw new Error(formatEnvError(error));
    }

    throw error;
  }
}

/**
 * Only pick the variables we actually use. Passing the whole `process.env`
 * would make validation depend on unrelated shell variables.
 */
export const ENV: Env = parseEnv({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
});
