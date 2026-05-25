// src/app/api/apps/[appId]/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger/logger";

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

    logger.info("api/logs", `Fetching workflow execution history for app ${appId}`);

    const logs = await prisma.workflowLog.findMany({
      where: { appId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Parse the details field from string to JSON object
    const formattedLogs = logs.map((log) => {
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(log.details);
      } catch {
        logger.error("api/logs", `Failed to parse workflow log details for log ID ${log.id}`);
      }
      return {
        ...log,
        details: parsedDetails,
      };
    });

    return NextResponse.json({ success: true, logs: formattedLogs });
  } catch (err: any) {
    logger.error("api/logs", "Failed to retrieve workflow logs", { error: err.message });
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
