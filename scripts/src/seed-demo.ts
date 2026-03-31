import {
  db, companies, branches, stations, users, clients, assets, rentals, rentalPlans,
  rentalStatusHistory, assetStatusHistory, payments, deposits, blacklistEntries,
  inquiries, b2bRequests, notifications, devices, assetDevices,
  telemetrySnapshots, telemetryEvents, batteries, batteryAssignments,
  userCompanyMemberships, userBranchMemberships, roles,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";

const DEMO_SLUG = "velocity-rides";

function hash(pw: string): string {
  const bcryptModule = require("bcrypt");
  return bcryptModule.hashSync(pw, 4);
}

function past(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function future(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d;
}

async function getRoleId(code: string): Promise<string> {
  const [role] = await db.select().from(roles).where(eq(roles.code, code)).limit(1);
  if (!role) throw new Error(`Role '${code}' not found. Run seed-rbac first.`);
  return role.id;
}

async function seedDemo() {
  console.log("🌱 Seeding demo data...\n");

  const [demoCompany] = await db.insert(companies).values({
    name: "Velocity Rides",
    slug: DEMO_SLUG,
    legalName: "Velocity Rides LLC",
    email: "info@velocityrides.demo",
    phone: "+1-555-0100",
    country: "US",
    currency: "USD",
    timezone: "America/New_York",
    status: "active",
  }).returning();
  console.log(`  Company: ${demoCompany.name} (${demoCompany.id})`);

  const branchData = [
    { name: "Downtown Hub", companyId: demoCompany.id },
    { name: "University Campus", companyId: demoCompany.id },
    { name: "Waterfront Station", companyId: demoCompany.id },
  ];
  const insertedBranches = await db.insert(branches).values(branchData).returning();
  console.log(`  Branches: ${insertedBranches.map(b => b.name).join(", ")}`);

  const stationData = [
    { name: "Main Office", companyId: demoCompany.id, branchId: insertedBranches[0].id, type: "hub" as const },
    { name: "Park Entrance", companyId: demoCompany.id, branchId: insertedBranches[0].id, type: "pickup_point" as const },
    { name: "Campus Gate", companyId: demoCompany.id, branchId: insertedBranches[1].id, type: "pickup_point" as const },
    { name: "Library Stop", companyId: demoCompany.id, branchId: insertedBranches[1].id, type: "pickup_point" as const },
    { name: "Marina Dock", companyId: demoCompany.id, branchId: insertedBranches[2].id, type: "pickup_point" as const },
    { name: "Service Center", companyId: demoCompany.id, branchId: insertedBranches[0].id, type: "service_center" as const },
  ];
  const insertedStations = await db.insert(stations).values(stationData).returning();
  console.log(`  Stations: ${insertedStations.length}`);

  const passwordHash = hash("demo1234");
  const staffData = [
    { email: "owner@velocityrides.demo", firstName: "Maria", lastName: "Johnson", passwordHash, isSuperAdmin: false },
    { email: "admin@velocityrides.demo", firstName: "Carlos", lastName: "Rivera", passwordHash, isSuperAdmin: false },
    { email: "manager@velocityrides.demo", firstName: "Sarah", lastName: "Chen", passwordHash, isSuperAdmin: false },
    { email: "operator@velocityrides.demo", firstName: "James", lastName: "Wilson", passwordHash, isSuperAdmin: false },
    { email: "mechanic@velocityrides.demo", firstName: "Andrei", lastName: "Volkov", passwordHash, isSuperAdmin: false },
    { email: "viewer@velocityrides.demo", firstName: "Emma", lastName: "Park", passwordHash, isSuperAdmin: false },
    { email: "accountant@velocityrides.demo", firstName: "Lucia", lastName: "Fernandez", passwordHash, isSuperAdmin: false },
  ];
  const insertedUsers = await db.insert(users).values(staffData).returning();
  console.log(`  Users: ${insertedUsers.map(u => `${u.firstName} (${u.email})`).join(", ")}`);

  const roleAssignments = [
    { userIdx: 0, role: "owner" },
    { userIdx: 1, role: "admin" },
    { userIdx: 2, role: "manager", branchIdx: 0 },
    { userIdx: 3, role: "operator", branchIdx: 1 },
    { userIdx: 4, role: "mechanic", branchIdx: 0 },
    { userIdx: 5, role: "viewer" },
    { userIdx: 6, role: "accountant" },
  ];

  for (const ra of roleAssignments) {
    const roleId = await getRoleId(ra.role);
    await db.insert(userCompanyMemberships).values({
      userId: insertedUsers[ra.userIdx].id,
      companyId: demoCompany.id,
      roleId,
      status: "active",
    });
    if (ra.branchIdx !== undefined) {
      await db.insert(userBranchMemberships).values({
        userId: insertedUsers[ra.userIdx].id,
        companyId: demoCompany.id,
        branchId: insertedBranches[ra.branchIdx].id,
        status: "active",
      });
    }
  }
  console.log("  Role assignments: done");

  const clientData = Array.from({ length: 20 }, (_, i) => ({
    companyId: demoCompany.id,
    fullName: [
      "Alex Thompson", "Jessica Wu", "Michael Brown", "Fatima Al-Hassan", "Tom Garcia",
      "Nina Patel", "David Kim", "Rachel Green", "Marco Rossi", "Yuki Tanaka",
      "Sarah Connor", "John Martinez", "Priya Sharma", "Lucas Dubois", "Elena Popova",
      "Jordan Lee", "Amara Osei", "Hans Mueller", "Mei Lin", "Omar Hassan",
    ][i],
    phone: `+1-555-${String(1000 + i).padStart(4, "0")}`,
    email: `client${i + 1}@demo.test`,
    documentType: "passport",
    documentNumber: `PASS-${String(100000 + i)}`,
    status: i < 17 ? "active" as const : i === 17 ? "suspended" as const : "blocked" as const,
  }));
  const insertedClients = await db.insert(clients).values(clientData).returning();
  console.log(`  Clients: ${insertedClients.length}`);

  const assetTypes = ["bike", "ebike", "scooter", "escooter"] as const;
  const brands = ["Trek", "Specialized", "Xiaomi", "Segway", "Bird", "Lime", "VanMoof", "Rad Power"];
  const models = ["Urban Pro", "City Cruiser", "Max G30", "Ninebot F40", "One", "S3", "Explorer", "Mission"];
  const statuses = [
    "available", "available", "available", "available", "available",
    "available", "available", "available", "available", "available",
    "rented", "rented", "rented", "rented", "rented",
    "rented", "rented",
    "overdue", "overdue",
    "maintenance", "maintenance",
    "charging", "charging",
    "reserved",
    "blocked",
    "lost",
    "draft", "draft",
    "available", "available",
    "available", "available", "available", "available", "available",
    "available", "available", "available", "available", "available",
  ] as const;

  const assetData = Array.from({ length: 40 }, (_, i) => ({
    companyId: demoCompany.id,
    branchId: insertedBranches[i % 3].id,
    stationId: insertedStations[i % 6].id,
    assetType: assetTypes[i % 4],
    brand: brands[i % 8],
    model: models[i % 8],
    serialNumber: `SN-${String(10000 + i)}`,
    internalCode: `VR-${String(i + 1).padStart(3, "0")}`,
    qrCode: `QR-VR-${String(i + 1).padStart(3, "0")}`,
    status: statuses[i],
    purchasePrice: String(200 + (i % 8) * 100),
    isPublic: i < 35,
  }));
  const insertedAssets = await db.insert(assets).values(assetData).returning();
  console.log(`  Assets: ${insertedAssets.length}`);

  for (const asset of insertedAssets) {
    await db.insert(assetStatusHistory).values({
      companyId: demoCompany.id,
      assetId: asset.id,
      toStatus: asset.status,
      reason: "Demo seed",
    });
  }

  const [plan1] = await db.insert(rentalPlans).values({
    companyId: demoCompany.id,
    name: "Hourly Basic",
    assetType: "bike",
    rentalType: "hourly",
    price: "5.00",
    depositAmount: "25.00",
    billingInterval: 1,
  }).returning();
  const [plan2] = await db.insert(rentalPlans).values({
    companyId: demoCompany.id,
    name: "Daily EBike",
    assetType: "ebike",
    rentalType: "daily",
    price: "25.00",
    depositAmount: "100.00",
    billingInterval: 1,
  }).returning();
  console.log("  Rental plans: 2");

  const rentalStatuses = [
    "active", "active", "active", "active",
    "completed", "completed", "completed", "completed", "completed",
    "overdue", "overdue",
    "awaiting_pickup",
    "draft",
    "canceled",
  ] as const;
  const rentedAssets = insertedAssets.filter(a => ["rented", "overdue", "available"].includes(a.status));
  const rentalData = rentalStatuses.map((status, i) => ({
    companyId: demoCompany.id,
    branchId: insertedBranches[i % 3].id,
    clientId: insertedClients[i % insertedClients.length].id,
    assetId: rentedAssets[i % rentedAssets.length].id,
    rentalPlanId: i % 2 === 0 ? plan1.id : plan2.id,
    rentalType: (i % 2 === 0 ? "hourly" : "daily") as "hourly" | "daily",
    status,
    tariffSnapshot: { name: i % 2 === 0 ? "Hourly Basic" : "Daily EBike", price: i % 2 === 0 ? "5.00" : "25.00" },
    depositAmount: i % 2 === 0 ? "25.00" : "100.00",
    startDate: status === "draft" ? null : past(status === "completed" ? 30 + i : 5 + i),
    endDate: status === "completed" ? past(25 + i) : (status === "overdue" ? past(1) : future(7)),
  }));
  const insertedRentals = await db.insert(rentals).values(rentalData).returning();
  console.log(`  Rentals: ${insertedRentals.length}`);

  for (const rental of insertedRentals) {
    await db.insert(rentalStatusHistory).values({
      companyId: demoCompany.id,
      rentalId: rental.id,
      toStatus: rental.status,
      reason: "Demo seed",
    });
  }

  const paymentData = insertedRentals
    .filter(r => r.status !== "draft")
    .map((r, i) => ({
      companyId: demoCompany.id,
      rentalId: r.id,
      clientId: r.clientId,
      amount: i % 2 === 0 ? "5.00" : "25.00",
      paymentType: "rental_payment" as const,
      status: r.status === "canceled" ? "refunded" as const : "paid" as const,
    }));
  const insertedPayments = await db.insert(payments).values(paymentData).returning();
  console.log(`  Payments: ${insertedPayments.length}`);

  const depositData = insertedRentals
    .filter(r => ["active", "overdue", "completed"].includes(r.status))
    .map((r) => ({
      companyId: demoCompany.id,
      rentalId: r.id,
      clientId: r.clientId!,
      amount: r.depositAmount ?? "25.00",
      status: r.status === "completed" ? "released" as const : "held" as const,
    }));
  if (depositData.length > 0) {
    const insertedDeposits = await db.insert(deposits).values(depositData).returning();
    console.log(`  Deposits: ${insertedDeposits.length}`);
  }

  await db.insert(blacklistEntries).values([
    {
      companyId: demoCompany.id,
      scopeType: "company",
      clientId: insertedClients[18].id,
      actionType: "blocked_company",
      reasonCode: "theft_attempt",
      reasonText: "Attempted to take scooter beyond operating zone",
      fullNameSnapshot: insertedClients[18].fullName,
      startsAt: past(15),
    },
    {
      companyId: demoCompany.id,
      branchId: insertedBranches[0].id,
      scopeType: "branch",
      clientId: insertedClients[17].id,
      actionType: "increased_deposit",
      reasonCode: "property_damage",
      reasonText: "Damaged bike handlebars",
      fullNameSnapshot: insertedClients[17].fullName,
      startsAt: past(10),
      endsAt: future(20),
    },
  ]);
  console.log("  Blacklist entries: 2");

  const inquiryData = Array.from({ length: 8 }, (_, i) => ({
    companyId: demoCompany.id,
    branchId: insertedBranches[i % 3].id,
    fullName: `Prospect ${i + 1}`,
    phone: `+1-555-2${String(i).padStart(3, "0")}`,
    email: `prospect${i + 1}@demo.test`,
    message: `Interested in renting a ${assetTypes[i % 4]} for ${["daily", "weekly", "monthly"][i % 3]} use.`,
    status: (["new", "in_review", "contacted", "converted", "new", "new", "contacted", "rejected"] as const)[i],
  }));
  await db.insert(inquiries).values(inquiryData);
  console.log("  Inquiries: 8");

  await db.insert(b2bRequests).values([
    {
      companyId: demoCompany.id,
      companyName: "TechCorp",
      contactName: "Lisa Wang",
      contactEmail: "lisa@techcorp.demo",
      fleetSize: 50,
      message: "Need fleet of ebikes for campus transport",
      status: "negotiating",
    },
    {
      companyId: demoCompany.id,
      companyName: "Hotel Marina",
      contactName: "Roberto Silva",
      contactEmail: "roberto@hotelmarina.demo",
      fleetSize: 20,
      message: "Guest scooter rental service for beachfront hotel",
      status: "new",
    },
  ]);
  console.log("  B2B requests: 2");

  const notifData = insertedUsers.slice(0, 3).flatMap((u) => [
    {
      userId: u.id,
      companyId: demoCompany.id,
      type: "rental_overdue" as const,
      title: "Rental Overdue",
      body: "Rental #R-001 is 2 days overdue. Contact client.",
    },
    {
      userId: u.id,
      companyId: demoCompany.id,
      type: "incident_created" as const,
      title: "New Incident Report",
      body: "Flat tire reported for asset VR-012.",
    },
  ]);
  await db.insert(notifications).values(notifData);
  console.log(`  Notifications: ${notifData.length}`);

  const deviceData = Array.from({ length: 10 }, (_, i) => ({
    companyId: demoCompany.id,
    serialNumber: `DEV-${String(1000 + i)}`,
    deviceType: (["gps_tracker", "smart_lock", "battery_bms", "controller", "gps_tracker"] as const)[i % 5],
    manufacturer: ["Teltonika", "Abus", "KeepTruckin", "Ninebot"][i % 4],
    model: ["FMB920", "SmartX", "BMS-Pro", "ESC-V2"][i % 4],
    firmwareVersion: `v${1 + (i % 3)}.${i % 10}.0`,
    status: i < 7 ? "active" as const : i === 7 ? "offline" as const : "maintenance" as const,
  }));
  const insertedDevices = await db.insert(devices).values(deviceData).returning();
  console.log(`  Devices: ${insertedDevices.length}`);

  const bindingsData = insertedDevices.slice(0, 8).map((d, i) => ({
    companyId: demoCompany.id,
    assetId: insertedAssets[i].id,
    deviceId: d.id,
    bindingType: (["tracker", "lock", "battery_bms", "controller"] as const)[i % 4],
    status: "active" as const,
  }));
  await db.insert(assetDevices).values(bindingsData);
  console.log(`  Asset-device bindings: ${bindingsData.length}`);

  const batteryData = Array.from({ length: 15 }, (_, i) => ({
    companyId: demoCompany.id,
    serialNumber: `BAT-${String(2000 + i)}`,
    manufacturer: ["Samsung", "LG", "Panasonic"][i % 3],
    model: ["INR21700", "MJ1", "NCR18650"][i % 3],
    capacityWh: 500 + (i % 5) * 100,
    healthPercent: Math.max(40, 100 - i * 4),
    cycleCount: i * 20,
    status: i < 10 ? "available" as const : i < 13 ? "installed" as const : "charging" as const,
  }));
  const insertedBatteries = await db.insert(batteries).values(batteryData).returning();
  console.log(`  Batteries: ${insertedBatteries.length}`);

  const batteryAssignData = insertedBatteries.slice(10, 13).map((b, i) => ({
    companyId: demoCompany.id,
    batteryId: b.id,
    assetId: insertedAssets[i].id,
    status: "active" as const,
  }));
  if (batteryAssignData.length > 0) {
    await db.insert(batteryAssignments).values(batteryAssignData);
    console.log(`  Battery assignments: ${batteryAssignData.length}`);
  }

  const telSnaps = insertedDevices.slice(0, 5).map((d, i) => ({
    deviceId: d.id,
    companyId: demoCompany.id,
    latitude: String(40.7128 + (i * 0.01)),
    longitude: String(-74.006 + (i * 0.01)),
    speed: String(i * 5),
    batteryLevel: 100 - i * 15,
    isOnline: i < 4,
    rawPayload: { demo: true },
    receivedAt: past(0),
  }));
  await db.insert(telemetrySnapshots).values(telSnaps);
  console.log(`  Telemetry snapshots: ${telSnaps.length}`);

  const telEvents = insertedDevices.slice(0, 5).flatMap((d, i) => [
    {
      deviceId: d.id,
      companyId: demoCompany.id,
      eventType: "online" as const,
      severity: "info" as const,
      data: {},
    },
    {
      deviceId: d.id,
      companyId: demoCompany.id,
      eventType: i === 4 ? "low_battery" as const : "location_update" as const,
      severity: i === 4 ? "warning" as const : "info" as const,
      data: {},
    },
  ]);
  await db.insert(telemetryEvents).values(telEvents);
  console.log(`  Telemetry events: ${telEvents.length}`);

  console.log("\n✅ Demo seed complete!");
  console.log("\n📋 Login credentials (password: demo1234):");
  for (const u of insertedUsers) {
    console.log(`   ${u.email}`);
  }
}

async function main() {
  const mode = process.argv[2] ?? "demo";

  if (mode === "demo") {
    await seedDemo();
  } else if (mode === "reset") {
    console.log(`🔄 Resetting demo tenant (${DEMO_SLUG})...`);
    const [existing] = await db.select().from(companies).where(eq(companies.slug, DEMO_SLUG)).limit(1);
    if (existing) {
      const { sql } = await import("drizzle-orm");
      const tables = await db.execute<{ tablename: string }>(
        sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('__drizzle_migrations', 'roles', 'permissions', 'role_permissions')`,
      );
      for (const { tablename } of tables.rows) {
        try {
          await db.execute(sql.raw(`DELETE FROM "${tablename}" WHERE company_id = '${existing.id}'`));
        } catch {}
      }
      await db.execute(sql.raw(`DELETE FROM "users" WHERE email LIKE '%@velocityrides.demo'`));
      await db.execute(sql.raw(`DELETE FROM "companies" WHERE id = '${existing.id}'`));
      console.log("  Old demo data cleared.");
    }
    await seedDemo();
  } else {
    console.error(`Unknown mode: ${mode}. Use 'demo' or 'reset'.`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
