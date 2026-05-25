// src/app/api/apps/[appId]/records/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import prisma from "@/lib/prisma";
import { z } from "zod";
import logger from "@/lib/logger/logger";
import { buildDynamicZodSchema } from "@/lib/schema/schemaParser";

const createRecordSchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  entityName: z.string().optional(),
  data: z.record(z.string(), z.any()),
});

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await props.params;
    const { searchParams } = new URL(request.url);
    const entityName = searchParams.get("entityName");

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Verify ownership of the app
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { userId: true, config: true, normalized: true },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    // Resolve unified entity lookup in GET request
    let queryEntityName = entityName;
    if (entityName) {
      let configObj: any = {};
      try {
        configObj = JSON.parse(app.normalized || app.config || "{}");
      } catch {}
      const entities = configObj.entities || [];
      const entityDef = entities.find(
        (e: any) => e.id === entityName || e.name === entityName
      );
      if (entityDef) {
        queryEntityName = entityDef.name;
        if (entityDef.name !== entityName) {
          logger.warn("api/records", `[WARN] crudController → entity lookup fallback activated: '${entityName}' resolved to '${queryEntityName}'`);
        } else {
          logger.info("api/records", `[INFO] crudController → entity resolved successfully: '${queryEntityName}'`);
        }
      }
    }

    logger.info(
      "api/records",
      `Listing records for app ${appId}${queryEntityName ? ` (entity: ${queryEntityName})` : ""}`
    );

    const records = await prisma.dynamicRecord.findMany({
      where: {
        appId,
        ...(queryEntityName ? { entityName: queryEntityName } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Parse the data field from JSON string to object
    const formattedRecords = records.map((rec) => {
      let parsedData = {};
      try {
        parsedData = JSON.parse(rec.data);
      } catch {
        logger.error("api/records", `Failed to parse JSON data for record ${rec.id}`);
      }
      return {
        ...rec,
        data: parsedData,
      };
    });

    return NextResponse.json({ success: true, records: formattedRecords });
  } catch (err: any) {
    logger.error("api/records", "Failed to list records", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Verify ownership of the app
    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const parsedBody = createRecordSchema.safeParse(body);
    if (!parsedBody.success) {
      const firstError = parsedBody.error.issues[0]?.message ?? "Invalid record payload.";
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const { entity, entityId, entityType, entityName, data } = parsedBody.data;

    // Standardize entity lookup reference following resilient extraction rules
    const entityRef = entity || entityId || entityType || entityName;

    if (!entityRef) {
      return NextResponse.json(
        { success: false, error: "Missing entity reference in payload. Provide 'entity', 'entityId', 'entityType', or 'entityName'." },
        { status: 400 }
      );
    }

    // Parse normalized config to get the entity fields definition
    let configObj: any = {};
    try {
      configObj = JSON.parse(app.normalized || app.config || "{}");
    } catch {
      logger.error("api/records", `Corrupted config JSON in app ${appId}`);
    }

    const entities = configObj.entities || [];

    // ── 3. Add Defensive Observability ──
    logger.info("api/records", `Resolving entity reference: ${entityRef}`);
    logger.info("api/records", `Available entities: ${JSON.stringify(entities.map((e: any) => ({ id: e.id || e.name, name: e.name })))}`);

    // ── 2. Fix Entity Lookup Resolution ──
    const entityDef = entities.find(
      (e: any) => e.id === entityRef || e.name === entityRef
    );

    if (!entityDef) {
      logger.warn("api/records", `[WARN] crudController → entity resolution failed for ${entityRef}`);
      return NextResponse.json(
        {
          success: false,
          error: `Entity '${entityRef}' could not be resolved`,
          availableEntities: entities.map((e: any) => ({
            id: e.id || e.name,
            name: e.name,
          })),
        },
        { status: 400 }
      );
    }

    if (entityDef.name !== entityRef) {
      logger.warn("api/records", `[WARN] crudController → entity lookup fallback activated: '${entityRef}' resolved to '${entityDef.name}'`);
    } else {
      logger.info("api/records", `[INFO] crudController → entity resolved successfully: '${entityDef.name}'`);
    }

    // Build dynamic validation schema using our parser utility
    const validationSchema = buildDynamicZodSchema(entityDef);
    const parsedData = validationSchema.safeParse(data);

    if (!parsedData.success) {
      const firstIssue = parsedData.error.issues[0];
      const errorMsg = firstIssue 
        ? `Field '${firstIssue.path.join(".")}' is invalid: ${firstIssue.message}`
        : "Record validation failed.";
      
      logger.warn("api/records", `Validation failed for entity ${entityDef.name}: ${errorMsg}`, parsedData.error.issues);
      return NextResponse.json({ success: false, error: errorMsg, validationErrors: parsedData.error.issues }, { status: 400 });
    }

    // Dynamic record save in database (stored as a serialized string) - standardizing to resolved entity name
    const newRecord = await prisma.dynamicRecord.create({
      data: {
        entityName: entityDef.name,
        data: JSON.stringify(parsedData.data),
        appId,
      },
    });

    const parsedRecord = {
      ...newRecord,
      data: parsedData.data,
    };

    logger.info("api/records", `[INFO] crudController → record persisted for entity: ${entityDef.name} (id: ${newRecord.id})`);

    // Fire off workflows asynchronously to avoid blocking user response
    triggerWorkflows(appId, entityDef.name, parsedRecord, "onRecordCreated").catch((err) => {
      logger.error("api/records", "Workflow execution background error", { error: err.message });
    });

    return NextResponse.json(
      {
        success: true,
        record: parsedRecord,
      },
      { status: 201 }
    );
  } catch (err: any) {
    logger.error("api/records", "Failed to create record", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * Evaluates and executes workflows for a given event asynchronously.
 */
async function triggerWorkflows(
  appId: string,
  entityName: string,
  record: any,
  triggerType: "onRecordCreated" | "onRecordUpdated"
) {
  try {
    const app = await prisma.app.findUnique({ where: { id: appId } });
    if (!app) return;

    let config: any = {};
    try {
      config = JSON.parse(app.normalized || app.config || "{}");
    } catch {
      return;
    }

    const workflows = config.workflows || [];

    for (const wf of workflows) {
      if (wf.trigger?.type === triggerType && wf.trigger?.entity === entityName) {
        logger.info("Workflows", `[INFO] workflowEngine → async workflow queued: '${wf.name}' (${wf.id}) for record ${record.id}`);

        for (const action of wf.actions || []) {
          let status = "SUCCESS";
          let details: any = { action: action.type, params: action.params };

          try {
            if (action.type === "webHookCall" && action.params?.url) {
              // Post to dynamic webhook with a defensive 5 second timeout
              const hookRes = await fetch(action.params.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ record, trigger: triggerType }),
                signal: AbortSignal.timeout(5000),
              });
              details.responseStatus = hookRes.status;
            } else if (action.type === "sendNotification") {
              // Simulate system notification alert
              details.simulated = true;
              details.recipient = action.params?.to || "default@workspace.local";
              logger.info("Workflows", `Simulating notification email to ${details.recipient} regarding record ${record.id}`);
            } else if (action.type === "updateRecord" && action.params?.fieldUpdates) {
              // Perform a merge-update on the record itself
              const currentRecord = await prisma.dynamicRecord.findUnique({
                where: { id: record.id },
              });

              if (currentRecord) {
                const currentData = JSON.parse(currentRecord.data);
                const updatedData = {
                  ...currentData,
                  ...action.params.fieldUpdates,
                };

                await prisma.dynamicRecord.update({
                  where: { id: record.id },
                  data: { data: JSON.stringify(updatedData) },
                });

                details.updatedFields = Object.keys(action.params.fieldUpdates);
                logger.info("Workflows", `Record ${record.id} dynamically updated by workflow ${wf.name}`);
              }
            }
          } catch (actionErr: any) {
            status = "FAILED";
            details.error = actionErr.message;
            logger.error("Workflows", `Action failed: ${action.type} in workflow ${wf.name}`, { error: actionErr.message });
          }

          // Create structured diagnostic run history logs
          await prisma.workflowLog.create({
            data: {
              workflowId: wf.id,
              workflowName: wf.name,
              triggerType,
              actionType: action.type,
              status,
              details: JSON.stringify(details),
              appId,
            },
          });
        }
      }
    }
  } catch (err: any) {
    logger.error("WorkflowEngine", "Workflow processing execution failed", { error: err.message });
  }
}
