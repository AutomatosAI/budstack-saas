import { NextResponse } from "next/server";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { callDrGreenAPI } from "@/lib/drgreen-api-client";
import { prisma } from "@/lib/db";

/**
 * TEMP DEBUG: Test Dr Green API from Railway server directly
 * DELETE THIS FILE after debugging
 */
export async function GET() {
  try {
    // Get HealingBuds tenant
    const tenant = await prisma.tenants.findFirst({
      where: { subdomain: "healingbuds" },
    });
    if (!tenant) return NextResponse.json({ error: "tenant not found" });

    const config = await getTenantDrGreenConfig(tenant.id);

    const results: any = {
      nodeVersion: process.version,
      apiUrl: config.apiUrl || "default",
      keyLen: config.apiKey?.length,
      secretLen: config.secretKey?.length,
    };

    // Test 1: GET /strains (no params, sign empty string)
    try {
      const res1 = await callDrGreenAPI<any>("/strains", {
        method: "GET",
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        baseUrl: config.apiUrl,
      });
      results.test1_noParams = { status: "OK", count: res1?.data?.strains?.length };
    } catch (e: any) {
      results.test1_noParams = { status: "FAIL", error: e.message?.slice(0, 200) };
    }

    // Test 2: GET /strains?countryCode=ZAF (with query params)
    try {
      const res2 = await callDrGreenAPI<any>("/strains", {
        method: "GET",
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        baseUrl: config.apiUrl,
        queryParams: { countryCode: "ZAF", orderBy: "desc", take: 10, page: 1 },
      });
      results.test2_withParams = { status: "OK", count: res2?.data?.strains?.length };
    } catch (e: any) {
      results.test2_withParams = { status: "FAIL", error: e.message?.slice(0, 200) };
    }

    // Test 3: GET /strains?country=ZAF (old param name)
    try {
      const res3 = await callDrGreenAPI<any>("/strains", {
        method: "GET",
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        baseUrl: config.apiUrl,
        queryParams: { country: "ZAF" },
      });
      results.test3_oldParam = { status: "OK", count: res3?.data?.strains?.length };
    } catch (e: any) {
      results.test3_oldParam = { status: "FAIL", error: e.message?.slice(0, 200) };
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
