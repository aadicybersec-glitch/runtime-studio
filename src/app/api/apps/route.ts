// src/app/api/apps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import prisma from "@/lib/prisma";
import { z } from "zod";
import logger from "@/lib/logger/logger";
import { parseAppConfig } from "@/lib/schema/schemaParser";

const createAppSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().optional(),
  config: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      logger.warn("api/apps", "Unauthorized GET request received");
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      logger.warn("api/apps", "Unauthorized GET request received: session user ID is missing.");
      return NextResponse.json({ success: false, error: "Session identity could not be verified. Please sign out and sign in again." }, { status: 401 });
    }

    logger.info("api/apps", `Fetching apps for user ID: ${userId}`);

    const apps = await prisma.app.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, apps });
  } catch (err: any) {
    logger.error("api/apps", "Failed to retrieve apps", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      logger.warn("api/apps", "Unauthorized POST request received");
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      logger.warn("api/apps", "Unauthorized POST request received: session user ID is missing.");
      return NextResponse.json({ success: false, error: "Session identity could not be verified. Please sign out and sign in again." }, { status: 401 });
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

    const parsed = createAppSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid request data.";
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const { name, description, config } = parsed.data;
    logger.info("api/apps", `Creating new app '${name}' for user ID: ${userId}`);

    // Standard baseline configuration
    const baseConfigObj = {
      appName: name,
      entities: [],
      layout: { sidebar: [] },
      pages: [],
      workflows: [],
    };
    
    const configText = config || JSON.stringify(baseConfigObj, null, 2);

    // Validate the config before saving
    const parseRes = parseAppConfig(configText);
    const normalizedText = parseRes.success && parseRes.config 
      ? JSON.stringify(parseRes.config) 
      : JSON.stringify(baseConfigObj);

    const app = await prisma.app.create({
      data: {
        name,
        description: description ?? null,
        config: configText,
        normalized: normalizedText,
        userId,
      },
    });

    logger.info("api/apps", `App successfully created: ${app.id}`);

    return NextResponse.json({
      success: true,
      app,
    }, { status: 201 });
  } catch (err: any) {
    logger.error("api/apps", "Failed to create app", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
