// src/app/api/logs/route.ts

import { NextResponse } from 'next/server'
import logger from '@/lib/logger/logger'

export async function GET() {
  const logs = logger.getLogs()
  return NextResponse.json({ logs })
}
