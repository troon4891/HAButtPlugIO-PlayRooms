import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, schema } from "../db/index.js";

export type ApprovalStatus = "approved" | "denied" | "pending";

export interface ApprovedDeviceRecord {
  id: string;
  deviceName: string;
  identifier: string;
  status: ApprovalStatus;
  displayName: string | null;
  firstSeenAt: number;
  approvedAt: number | null;
  updatedAt: number;
}

function generateId(): string {
  return randomBytes(12).toString("hex");
}

/**
 * Look up or create a device record when it's first discovered.
 * If the device was previously approved/denied, returns the existing status.
 * If new, inserts as 'pending'.
 */
export async function getOrCreateDevice(
  deviceName: string,
  identifier: string
): Promise<ApprovedDeviceRecord> {
  const existing = await db
    .select()
    .from(schema.approvedDevices)
    .where(eq(schema.approvedDevices.identifier, identifier))
    .limit(1);

  if (existing.length > 0) {
    return existing[0] as ApprovedDeviceRecord;
  }

  const now = Date.now();
  const record: ApprovedDeviceRecord = {
    id: generateId(),
    deviceName,
    identifier,
    status: "pending",
    displayName: null,
    firstSeenAt: now,
    approvedAt: null,
    updatedAt: now,
  };

  await db.insert(schema.approvedDevices).values({
    id: record.id,
    deviceName: record.deviceName,
    identifier: record.identifier,
    status: record.status,
    displayName: record.displayName,
    firstSeenAt: record.firstSeenAt,
    approvedAt: record.approvedAt,
    updatedAt: record.updatedAt,
  });

  return record;
}

export async function approveDevice(id: string): Promise<void> {
  const now = Date.now();
  await db
    .update(schema.approvedDevices)
    .set({ status: "approved", approvedAt: now, updatedAt: now })
    .where(eq(schema.approvedDevices.id, id));
}

export async function denyDevice(id: string): Promise<void> {
  await db
    .update(schema.approvedDevices)
    .set({ status: "denied", updatedAt: Date.now() })
    .where(eq(schema.approvedDevices.id, id));
}

export async function resetDevice(id: string): Promise<void> {
  await db
    .update(schema.approvedDevices)
    .set({ status: "pending", approvedAt: null, updatedAt: Date.now() })
    .where(eq(schema.approvedDevices.id, id));
}

export async function getApprovedDevices(): Promise<ApprovedDeviceRecord[]> {
  return (await db
    .select()
    .from(schema.approvedDevices)
    .where(eq(schema.approvedDevices.status, "approved"))) as ApprovedDeviceRecord[];
}

export async function getAllDeviceRecords(): Promise<ApprovedDeviceRecord[]> {
  return (await db.select().from(schema.approvedDevices)) as ApprovedDeviceRecord[];
}

export async function isDeviceApproved(identifier: string): Promise<boolean> {
  const rows = await db
    .select({ status: schema.approvedDevices.status })
    .from(schema.approvedDevices)
    .where(eq(schema.approvedDevices.identifier, identifier))
    .limit(1);
  return rows.length > 0 && rows[0].status === "approved";
}
