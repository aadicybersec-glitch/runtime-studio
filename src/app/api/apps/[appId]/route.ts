// src/app/api/apps/[appId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import prisma from "@/lib/prisma";
import { z } from "zod";
import logger from "@/lib/logger/logger";
import { parseAppConfig } from "@/lib/schema/schemaParser";

const updateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  config: z.string().optional(),
});

export async function GET(
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
    logger.info("api/apps/[id]", `Fetching app ${appId} for user ${userId}`);

    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      logger.warn("api/apps/[id]", `User ${userId} attempted unauthorized access to app ${appId}`);
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    return NextResponse.json({ success: true, app });
  } catch (err: any) {
    logger.error("api/apps/[id]", "Failed to retrieve app", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const parsed = updateAppSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid request data.";
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      logger.warn("api/apps/[id]", `User ${userId} attempted unauthorized update of app ${appId}`);
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    
    if (parsed.data.config !== undefined) {
      updateData.config = parsed.data.config;
      
      // Parse & normalize config defensively
      const parseRes = parseAppConfig(parsed.data.config);
      if (parseRes.success && parseRes.config) {
        updateData.normalized = JSON.stringify(parseRes.config);
      } else {
        // If recovery completely failed, keep the last known normalized config to ensure stability,
        // but let the user know through response telemetry / logs.
        logger.warn("api/apps/[id]", `Failed to normalize config for app ${appId}. Storing raw JSON and preserving last stable normalized structure.`);
      }
    }

    const updatedApp = await prisma.app.update({
      where: { id: appId },
      data: updateData,
    });

    logger.info("api/apps/[id]", `App updated successfully: ${appId}`);

    return NextResponse.json({
      success: true,
      app: updatedApp,
    });
  } catch (err: any) {
    logger.error("api/apps/[id]", "Failed to update app", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    logger.info("api/apps/[id]", `Deleting app ${appId} for user ${userId}`);

    const app = await prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (app.userId !== userId) {
      logger.warn("api/apps/[id]", `User ${userId} attempted unauthorized delete of app ${appId}`);
      return NextResponse.json({ success: false, error: "Forbidden access." }, { status: 403 });
    }

    await prisma.app.delete({
      where: { id: appId },
    });

    logger.info("api/apps/[id]", `App deleted successfully: ${appId}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("api/apps/[id]", "Failed to delete app", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
