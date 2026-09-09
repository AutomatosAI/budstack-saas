/**
 * THROWAWAY spike — validate the legacy-AML → ID-upload switch against Dr Green
 * STAGING end-to-end, the way any storefront would: pure API, no DB seeding.
 * NOT shipped and NOT imported anywhere.
 *
 * A "stuck legacy client" is created through the front door: a KYC-type
 * registration (full medicalRecord, ZAF shipping, no verificationType) whose
 * First-AML case nobody will ever complete — exactly the state of the real
 * pre-June cohort.
 *
 * Prereqs on Dr Green staging: STG_SA_ID_ENABLED=true (it is, live).
 *
 * Phase 1 (default) — creates fixtures and runs every automatic assertion:
 *
 *   DRG_HOST=https://stage-api.drgreennft.com/api/v1 \
 *   DRG_APIKEY=... DRG_SECRET=... \
 *   pnpm exec tsx scripts/_spike/verify-switch-to-id.ts
 *
 * It prints the created client id + a manual checklist (reject in stage-admin,
 * then Accept in stage-admin — the real button, on purpose). After each manual
 * step, re-run with the phase env:
 *
 *   DRG_PHASE=post-reject DRG_CLIENT_ID=<id> ... verify-switch-to-id.ts
 *   DRG_PHASE=post-accept DRG_CLIENT_ID=<id> ... verify-switch-to-id.ts
 */
import { switchClientToIdVerification, uploadIdentityDocument } from "../../lib/drgreen-identity";
import { callDrGreenAPI } from "../../lib/drgreen/drgreen-api-client";
import { fetchClient } from "../../lib/drgreen/doctor-green-api";

const HOST = process.env.DRG_HOST || "https://stage-api.drgreennft.com/api/v1";
const APIKEY = process.env.DRG_APIKEY || "";
const SECRET = process.env.DRG_SECRET || "";
const PHASE = process.env.DRG_PHASE || "full";

const config = { apiKey: APIKEY, secretKey: SECRET };
const fetchCfg = { apiKey: APIKEY, secretKey: SECRET, apiUrl: HOST };

// 1x1 transparent PNG — enough for the upload contract (mime + size checks).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

let failures = 0;
function ok(label: string) {
  console.log(`✅ ${label}`);
}
function fail(label: string, detail?: unknown) {
  failures++;
  console.error(`❌ ${label}`, detail ?? "");
}
function assertEq(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) ok(`${label} = ${String(expected)}`);
  else fail(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

// Known-valid medicalRecord (mirrors the live KYC consultation payload).
function medicalRecord(dob: string) {
  return {
    dob,
    gender: "Male",
    medicalConditions: ["anxiety"],
    medicinesTreatments: ["melatonin"],
    otherMedicalTreatments: "",
    prescriptionsSupplements: "",
    medicalHistory0: false,
    medicalHistory1: false,
    medicalHistory2: false,
    medicalHistory3: false,
    medicalHistory4: false,
    medicalHistory5: ["none"],
    medicalHistory6: false,
    medicalHistory7: ["none"],
    medicalHistory7Relation: "none",
    medicalHistory8: false,
    medicalHistory9: false,
    medicalHistory10: false,
    medicalHistory11: "0",
    medicalHistory12: false,
    medicalHistory13: "never",
    medicalHistory14: ["never"],
    medicalHistory15: "",
    medicalHistory16: false,
  };
}

function extractClientId(response: any): string | undefined {
  return (
    response?.data?.client?.id ||
    response?.data?.id ||
    response?.client?.id ||
    response?.id
  );
}

async function createKycClient(opts: {
  tag: string;
  countryCode3: string; // "ZAF" | "PRT"
  country: string;
  city: string;
  state: string;
  postalCode: string;
  phoneCode: string;
  phoneCountryCode: string;
}) {
  const stamp = Date.now().toString().slice(-9);
  const body = {
    firstName: "SwitchSpike",
    lastName: opts.tag,
    email: `gerard161+switch-${opts.tag.toLowerCase()}-${stamp}@gmail.com`,
    phoneCode: opts.phoneCode,
    phoneCountryCode: opts.phoneCountryCode,
    contactNumber: `8${stamp.slice(0, 8)}`, // unique digits-only
    // NO verificationType → defaults to KYC → real First-AML case, left stuck.
    shipping: {
      address1: "1 Test Street",
      address2: "",
      landmark: "",
      city: opts.city,
      state: opts.state,
      country: opts.country,
      postalCode: opts.postalCode,
      countryCode: opts.countryCode3,
    },
    medicalRecord: medicalRecord("1990-01-01"),
  };
  const res = await callDrGreenAPI<any>("/dapp/clients", {
    method: "POST",
    apiKey: APIKEY,
    secretKey: SECRET,
    baseUrl: HOST,
    body,
  });
  const id = extractClientId(res);
  if (!id) throw new Error(`no client id in create response: ${JSON.stringify(res).slice(0, 300)}`);
  return { id, email: body.email };
}

async function expectSwitchRefusal(label: string, clientId: string, fragment: RegExp) {
  try {
    await switchClientToIdVerification({ clientId, config, baseUrl: HOST });
    fail(`${label}: switch unexpectedly succeeded`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (fragment.test(msg)) ok(`${label} refused as expected (${fragment})`);
    else fail(`${label}: refused with unexpected error`, msg);
  }
}

async function phaseFull() {
  console.log(`\n— Phase 1: fixtures + automatic assertions against ${HOST}\n`);

  // 1. Stuck ZAF legacy client, born through the front door.
  const za = await createKycClient({
    tag: "ZA",
    countryCode3: "ZAF",
    country: "South Africa",
    city: "Cape Town",
    state: "Western Cape",
    postalCode: "8001",
    phoneCode: "+27",
    phoneCountryCode: "ZA",
  });
  ok(`created stuck ZAF KYC client ${za.id} (${za.email})`);

  const before = await fetchClient(za.id, fetchCfg);
  assertEq("pre-switch verificationType", before.verificationType, "KYC");
  assertEq("pre-switch isKYCVerified", before.isKYCVerified, false);
  assertEq("pre-switch adminApproval", before.adminApproval, "PENDING");

  // 2. Non-ZAF control — must be refused.
  const pt = await createKycClient({
    tag: "PT",
    countryCode3: "PRT",
    country: "Portugal",
    city: "Lisbon",
    state: "Lisboa",
    postalCode: "1000-001",
    phoneCode: "+351",
    phoneCountryCode: "PT",
  });
  ok(`created non-ZAF control client ${pt.id}`);
  await expectSwitchRefusal("non-ZAF switch", pt.id, /South African/i);

  // 3. The switch.
  const switched = await switchClientToIdVerification({ clientId: za.id, config, baseUrl: HOST });
  assertEq("post-switch verificationType", switched.verificationType, "ID");

  // 4. Idempotency.
  const again = await switchClientToIdVerification({ clientId: za.id, config, baseUrl: HOST });
  assertEq("idempotent re-switch verificationType", again.verificationType, "ID");

  // 5. Upload an ID document (multipart, byte-exact signing).
  const doc = await uploadIdentityDocument({
    clientId: za.id,
    documentType: "ID",
    documentNumber: "SPIKE-SWITCH-001",
    file: TINY_PNG,
    mimeType: "image/png",
    config,
    baseUrl: HOST,
  });
  assertEq("uploaded document reviewStatus", doc.reviewStatus, "PENDING");

  console.log(`
— Manual steps in stage-admin (ClientVerification), then re-run phases —

  Client: ${za.id}  (${za.email})

  a) REJECT the client with any reason ≥5 chars, then:
     DRG_PHASE=post-reject DRG_CLIENT_ID=${za.id} DRG_APIKEY=… DRG_SECRET=… pnpm exec tsx scripts/_spike/verify-switch-to-id.ts

  b) ACCEPT the client (the real button — flags + on-chain), then:
     DRG_PHASE=post-accept DRG_CLIENT_ID=${za.id} DRG_APIKEY=… DRG_SECRET=… pnpm exec tsx scripts/_spike/verify-switch-to-id.ts
`);
}

async function phasePostReject(clientId: string) {
  console.log(`\n— Phase post-reject: re-upload must reset ${clientId} to PENDING\n`);
  const rejected = await fetchClient(clientId, fetchCfg);
  assertEq("pre-reupload adminApproval", rejected.adminApproval, "REJECTED");

  await uploadIdentityDocument({
    clientId,
    documentType: "ID",
    documentNumber: "SPIKE-SWITCH-002",
    file: TINY_PNG,
    mimeType: "image/png",
    config,
    baseUrl: HOST,
  });
  const after = await fetchClient(clientId, fetchCfg);
  assertEq("post-reupload adminApproval (auto-reset)", after.adminApproval, "PENDING");
  assertEq("rejectionNote cleared", after.rejectionNote ?? null, null);
}

async function phasePostAccept(clientId: string) {
  console.log(`\n— Phase post-accept: Accept must fully verify ${clientId}\n`);
  const client = await fetchClient(clientId, fetchCfg);
  assertEq("verificationType", client.verificationType, "ID");
  assertEq("isKYCVerified (the #486 path for ID clients)", client.isKYCVerified, true);
  assertEq("adminApproval", client.adminApproval, "VERIFIED");
  assertEq("isActive", client.isActive, true);
  // A switched-then-verified client must never be switchable again.
  await expectSwitchRefusal("switch-after-verify", clientId, /already/i);
}

async function main() {
  if (!APIKEY || !SECRET) {
    throw new Error("Set DRG_APIKEY and DRG_SECRET (staging keypair; env only — never a file).");
  }
  if (PHASE === "full") await phaseFull();
  else if (PHASE === "post-reject") await phasePostReject(requiredClientId());
  else if (PHASE === "post-accept") await phasePostAccept(requiredClientId());
  else throw new Error(`Unknown DRG_PHASE: ${PHASE}`);

  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll assertions in this phase passed.");
}

function requiredClientId(): string {
  const id = process.env.DRG_CLIENT_ID;
  if (!id) throw new Error("Set DRG_CLIENT_ID for this phase.");
  return id;
}

main().catch((err) => {
  console.error("❌ Spike aborted:", err?.message || err);
  process.exit(1);
});
