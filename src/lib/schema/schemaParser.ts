// src/lib/schema/schemaParser.ts
import { z, ZodIssue } from "zod";

import {
  AppConfigSchema,
  EntityDefinitionSchema,
  PageDefinitionSchema,
  WorkflowDefinitionSchema,
  type ValidatedAppConfig,
  type ValidatedEntity,
} from "@/lib/validation/schema";
import logger from "@/lib/logger/logger";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParseError {
  code: string;
  message: string;
  path?: string;
}

export interface ParseWarning {
  code: string;
  message: string;
  path?: string;
  recovered?: boolean;
}

export interface ParseResult {
  success: boolean;
  config: ValidatedAppConfig | null;
  errors: ParseError[];
  warnings: ParseWarning[];
  rawInput?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function zodPathToString(path: (string | number | symbol)[]): string {
  return path.reduce<string>((acc, segment, idx) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    const segmentStr = String(segment);
    return idx === 0 ? segmentStr : `${acc}.${segmentStr}`;
  }, "");
}

/**
 * Maps a flat array of Zod issues to our ParseError format.
 */
function zodIssuesToErrors(issues: ZodIssue[]): ParseError[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: zodPathToString(issue.path),
  }));
}

/**
 * Filters an unknown array to only items that pass the given Zod schema.
 * Returns both the valid items and warnings for every dropped item.
 */
function recoverArray<T>(
  items: unknown[],
  schema: z.ZodType<T>,
  arrayName: string
): { valid: T[]; warnings: ParseWarning[] } {
  const valid: T[] = [];
  const warnings: ParseWarning[] = [];

  for (let i = 0; i < items.length; i++) {
    const result = schema.safeParse(items[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      const firstIssue = result.error.issues[0];
      const detail = firstIssue
        ? ` (${zodPathToString(firstIssue.path)}: ${firstIssue.message})`
        : "";

      const warning: ParseWarning = {
        code: "INVALID_ARRAY_ITEM",
        message: `Dropped invalid item at ${arrayName}[${i}]${detail}`,
        path: `${arrayName}[${i}]`,
        recovered: true,
      };

      warnings.push(warning);

      logger.warn(
        "schemaParser",
        `Dropped invalid ${arrayName} item at index ${i}${detail}`,
        result.error.issues
      );
    }
  }

  return { valid, warnings };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses a raw JSON string into a validated AppConfig.
 *
 * The function is intentionally non-throwing: all errors are captured and
 * returned inside the `ParseResult` envelope.
 *
 * Recovery strategy (when strict validation fails):
 *   1. Strip invalid items from `entities`, `pages`, and `workflows` arrays.
 *   2. Re-run AppConfigSchema.safeParse() with the cleaned payload.
 *   3. If the second pass succeeds, surface per-item warnings.
 *   4. If the second pass still fails, surface all Zod errors.
 */
/**
 * Normalizes user configurations defensively to align with runtime schema contracts.
 * 1. Coerces workflow triggers from string short-forms to standardized trigger objects.
 * 2. Ensures every workflow action has a defined `params` object block.
 */
function normalizeParsedConfig(parsed: any): any {
  if (parsed === null || typeof parsed !== "object") return parsed;

  const normalized = { ...parsed };

  // Normalize workflows array
  if (Array.isArray(normalized.workflows)) {
    normalized.workflows = normalized.workflows.map((wf: any, idx: number) => {
      if (wf === null || typeof wf !== "object") return wf;
      const normalizedWf = { ...wf };

      // 1. Trigger Normalization
      if (typeof normalizedWf.trigger === "string") {
        const triggerStr = normalizedWf.trigger;
        normalizedWf.trigger = {
          type: triggerStr === "onRecordUpdated" ? "onRecordUpdated" : "onRecordCreated",
          entity: "workouts", // Standard default entity reference
        };
        logger.info(
          "schemaParser",
          `[INFO] normalizationPipeline → Coerced string trigger "${triggerStr}" to trigger object at workflows[${idx}]`
        );
      } else if (normalizedWf.trigger && typeof normalizedWf.trigger === "object") {
        normalizedWf.trigger = {
          type: normalizedWf.trigger.type || "onRecordCreated",
          entity: normalizedWf.trigger.entity || "workouts",
        };
      } else {
        normalizedWf.trigger = {
          type: "onRecordCreated",
          entity: "workouts",
        };
      }

      // 2. Action Params Normalization
      if (Array.isArray(normalizedWf.actions)) {
        normalizedWf.actions = normalizedWf.actions.map((act: any, actIdx: number) => {
          if (act === null || typeof act !== "object") return act;
          const normalizedAct = { ...act };
          if (!normalizedAct.params || typeof normalizedAct.params !== "object") {
            normalizedAct.params = {};
            logger.info(
              "schemaParser",
              `[INFO] normalizationPipeline → Injected default params block at workflows[${idx}].actions[${actIdx}]`
            );
          }
          return normalizedAct;
        });
      }

      return normalizedWf;
    });
  }

  logger.info("schemaParser", "[TRACE] parser → normalization pipeline completed");
  return normalized;
}

export function parseAppConfig(raw: string): ParseResult {
  // ── Step 1: JSON syntax check ───────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message =
      err instanceof SyntaxError
        ? err.message
        : "Unknown JSON parse error";

    logger.error("schemaParser", "JSON.parse failed", { message, raw: raw.slice(0, 200) });

    return {
      success: false,
      config: null,
      errors: [{ code: "INVALID_JSON", message: `JSON syntax error: ${message}` }],
      warnings: [],
      rawInput: raw,
    };
  }

  logger.info("schemaParser", "JSON.parse succeeded — starting Zod validation");

  // ── Step 1.5: Ingestion Normalization Layer ──────────────────────────────
  let normalizedParsed: any = parsed;
  try {
    normalizedParsed = normalizeParsedConfig(parsed);
  } catch (err: any) {
    logger.warn("schemaParser", `Normalization layer failed: ${err.message}`);
  }

  // ── Step 2: Strict Zod validation ───────────────────────────────────────
  const strictResult = AppConfigSchema.safeParse(normalizedParsed);

  if (strictResult.success) {
    logger.info("schemaParser", "AppConfigSchema validation passed (strict pass)");
    return {
      success: true,
      config: strictResult.data,
      errors: [],
      warnings: [],
      rawInput: raw,
    };
  }

  // ── Step 3: Attempt graceful recovery ───────────────────────────────────
  logger.warn(
    "schemaParser",
    `Strict validation failed with ${strictResult.error.issues.length} issue(s) — attempting recovery`,
    strictResult.error.issues
  );

  const allWarnings: ParseWarning[] = [];

  // We need a base object to work with — fall back to empty object if the
  // parsed value is not an object at all, so recovery still produces useful
  // error messages on the second pass.
  const base: Record<string, unknown> =
    normalizedParsed !== null && typeof normalizedParsed === "object" && !Array.isArray(normalizedParsed)
      ? (normalizedParsed as Record<string, unknown>)
      : {};

  // Recover entities
  const rawEntities = Array.isArray(base.entities) ? (base.entities as unknown[]) : [];
  const { valid: recoveredEntities, warnings: entityWarnings } = recoverArray(
    rawEntities,
    EntityDefinitionSchema,
    "entities"
  );
  allWarnings.push(...entityWarnings);

  // Recover pages
  const rawPages = Array.isArray(base.pages) ? (base.pages as unknown[]) : [];
  const { valid: recoveredPages, warnings: pageWarnings } = recoverArray(
    rawPages,
    PageDefinitionSchema,
    "pages"
  );
  allWarnings.push(...pageWarnings);

  // Recover workflows
  const rawWorkflows = Array.isArray(base.workflows) ? (base.workflows as unknown[]) : [];
  const { valid: recoveredWorkflows, warnings: workflowWarnings } = recoverArray(
    rawWorkflows,
    WorkflowDefinitionSchema,
    "workflows"
  );
  allWarnings.push(...workflowWarnings);

  // Build the recovered payload — spread the raw base so top-level fields
  // (appName, layout, etc.) are preserved, then override the three arrays.
  const recoveredPayload: Record<string, unknown> = {
    ...base,
    entities: recoveredEntities,
    pages: recoveredPages,
    workflows: recoveredWorkflows,
  };

  // ── Step 4: Second Zod pass with recovered payload ───────────────────────
  const recoveryResult = AppConfigSchema.safeParse(recoveredPayload);

  if (recoveryResult.success) {
    logger.info(
      "schemaParser",
      `Recovery succeeded — ${allWarnings.length} item(s) were dropped`
    );
    return {
      success: true,
      config: recoveryResult.data,
      errors: [],
      warnings: allWarnings,
      rawInput: raw,
    };
  }

  // ── Step 5: Recovery also failed — report all errors ────────────────────
  const finalErrors = zodIssuesToErrors(recoveryResult.error.issues);

  logger.error(
    "schemaParser",
    `Recovery also failed with ${finalErrors.length} error(s)`,
    recoveryResult.error.issues
  );

  return {
    success: false,
    config: null,
    errors: finalErrors,
    warnings: allWarnings,
    rawInput: raw,
  };
}

// ---------------------------------------------------------------------------
// Dynamic runtime schema builder
// ---------------------------------------------------------------------------

/**
 * Given a validated entity definition, returns a Zod object schema that can
 * be used to validate arbitrary record payloads for that entity at runtime.
 *
 * Field-type → Zod mapping:
 *   text | textarea | email | password → z.string()
 *   number                             → z.number()
 *   checkbox                           → z.boolean()
 *   date                               → z.string()
 *   select | radio                     → z.string()
 *   tags                               → z.array(z.string())
 *
 * Fields where `required` is not explicitly `true` get `.optional()`.
 */
export function buildDynamicZodSchema(
  entity: ValidatedEntity
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of entity.fields) {
    let base: z.ZodTypeAny;

    switch (field.type) {
      case "text":
      case "textarea":
      case "email":
      case "password":
        base = z.string();
        break;

      case "number":
        base = z.number();
        break;

      case "checkbox":
        base = z.boolean();
        break;

      case "date":
        base = z.string();
        break;

      case "select":
      case "radio":
        base = z.string();
        break;

      case "tags":
        base = z.array(z.string());
        break;

      default: {
        // Exhaustive check — TypeScript will catch unhandled FieldType values
        const _exhaustive: never = field.type;
        logger.warn(
          "schemaParser",
          `buildDynamicZodSchema: unrecognised field type '${_exhaustive}' for field '${field.name}' — falling back to z.any()`
        );
        base = z.any();
        break;
      }
    }

    // Apply optionality based on the `required` flag
    shape[field.name] = field.required === true ? base : base.optional();
  }

  return z.object(shape);
}
