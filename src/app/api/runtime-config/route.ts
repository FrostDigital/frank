import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
    return NextResponse.json({
        FOLDER_DELETE_MODE: process.env.FOLDER_DELETE_MODE || "DETACH",
    })
}
