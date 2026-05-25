// src/app/api/apps/[appId]/records/[recordId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import prisma from "@/lib/prisma";
import { z } from "zod";
import logger from "@/lib/logger/logger";
import { buildDynamicZodSchema } from "@/lib/schema/schemaParser";

const updateRecordSchema = z.object({
  data: z.record(z.string(), z.any()),
});

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ appId: string; recordId: string }> }
) {
  try {
    const { appId, recordId } = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Verify ownership of the app
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { userId: true },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    const record = await prisma.dynamicRecord.findUnique({
      where: { id: recordId, appId },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(record.data);
    } catch {
      logger.error("api/records/[id]", `Failed to parse data for record ${record.id}`);
    }

    return NextResponse.json({
      success: true,
      record: {
        ...record,
        data: parsedData,
      },
    });
  } catch (err: any) {
    logger.error("api/records/[id]", "Failed to retrieve record", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ appId: string; recordId: string }> }
) {
  try {
    const { appId, recordId } = await props.params;
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

    const record = await prisma.dynamicRecord.findUnique({
      where: { id: recordId, appId },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
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

    const parsedBody = updateRecordSchema.safeParse(body);
    if (!parsedBody.success) {
      const firstError = parsedBody.error.issues[0]?.message ?? "Invalid update payload.";
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const { data } = parsedBody.data;

    // Parse the entity fields definition from app config
    let configObj: any = {};
    try {
      configObj = JSON.parse(app.normalized || app.config || "{}");
    } catch {
      logger.error("api/records/[id]", `Corrupted config JSON in app ${appId}`);
    }

    const entities = configObj.entities || [];
    const entityDef = entities.find(
      (e: any) => e.name === record.entityName || e.id === record.entityName
    );

    if (!entityDef) {
      logger.warn("api/records/[id]", `[WARN] crudController → entity resolution failed for '${record.entityName}'`);
      return NextResponse.json(
        {
          success: false,
          error: `Entity '${record.entityName}' could not be resolved`,
          availableEntities: entities.map((e: any) => ({
            id: e.id || e.name,
            name: e.name,
          })),
        },
        { status: 400 }
      );
    }

    if (entityDef.name !== record.entityName) {
      logger.warn("api/records/[id]", `[WARN] crudController → entity lookup fallback activated: '${record.entityName}' resolved to '${entityDef.name}'`);
    } else {
      logger.info("api/records/[id]", `[INFO] crudController → entity resolved successfully: '${entityDef.name}'`);
    }

    // Merge existing record data with update data and validate
    let existingData = {};
    try {
      existingData = JSON.parse(record.data);
    } catch {
      logger.error("api/records/[id]", `Failed to parse raw data for record ${record.id}`);
    }

    const mergedData = {
      ...existingData,
      ...data,
    };

    const validationSchema = buildDynamicZodSchema(entityDef);
    const parsedData = validationSchema.safeParse(mergedData);

    if (!parsedData.success) {
      const firstIssue = parsedData.error.issues[0];
      const errorMsg = firstIssue 
        ? `Field '${firstIssue.path.join(".")}' is invalid: ${firstIssue.message}`
        : "Merged record validation failed.";
      
      logger.warn("api/records/[id]", `Validation failed for update of ${record.entityName}: ${errorMsg}`);
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const updatedRecord = await prisma.dynamicRecord.update({
      where: { id: recordId },
      data: {
        data: JSON.stringify(parsedData.data),
      },
    });

    const parsedRecord = {
      ...updatedRecord,
      data: parsedData.data,
    };

    logger.info("api/records/[id]", `Record updated successfully: ${recordId}`);

    // Fire off workflows asynchronously
    triggerWorkflows(appId, record.entityName, parsedRecord, "onRecordUpdated").catch((err) => {
      logger.error("api/records/[id]", "Workflow execution background error", { error: err.message });
    });

    return NextResponse.json({
      success: true,
      record: parsedRecord,
    });
  } catch (err: any) {
    logger.error("api/records/[id]", "Failed to update record", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ appId: string; recordId: string }> }
) {
  try {
    const { appId, recordId } = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Verify ownership of the app
    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { userId: true },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    const record = await prisma.dynamicRecord.findUnique({
      where: { id: recordId, appId },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: "Record not found." }, { status: 404 });
    }

    await prisma.dynamicRecord.delete({
      where: { id: recordId },
    });

    logger.info("api/records/[id]", `Record deleted successfully: ${recordId}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("api/records/[id]", "Failed to delete record", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * Duplicate of asynchronous workflows trigger pipeline for update triggers.
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
              const hookRes = await fetch(action.params.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ record, trigger: triggerType }),
                signal: AbortSignal.timeout(5000),
              });
              details.responseStatus = hookRes.status;
            } else if (action.type === "sendNotification") {
              details.simulated = true;
              details.recipient = action.params?.to || "default@workspace.local";
              logger.info("Workflows", `Simulating notification email to ${details.recipient} regarding record ${record.id}`);
            } else if (action.type === "updateRecord" && action.params?.fieldUpdates) {
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
