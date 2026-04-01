import {
  db, companies, branches, stations, users, clients, assets, rentals, rentalPlans,
  rentalStatusHistory, assetStatusHistory, payments, deposits, blacklistEntries,
  inquiries, b2bRequests, notifications, devices, assetDevices,
  telemetrySnapshots, telemetryEvents, batteries, batteryAssignments,
  userCompanyMemberships, userBranchMemberships, roles,
  platformRoles, platformUserRoles,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";

const DEMO_SLUG = "velocity-rides";

async function hash(pw: string): Promise<string> {
  const bcryptModule = await import("bcrypt");
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

  const passwordHash = await hash("demo1234");
  const staffData = [
    { email: "owner@velocityrides.demo",     phone: "+79991000001", phoneVerified: true, firstName: "Maria",  lastName: "Johnson",  passwordHash, isSuperAdmin: false },
    { email: "admin@velocityrides.demo",      phone: "+79991000002", phoneVerified: true, firstName: "Carlos", lastName: "Rivera",   passwordHash, isSuperAdmin: false },
    { email: "manager@velocityrides.demo",    phone: "+79991000003", phoneVerified: true, firstName: "Sarah",  lastName: "Chen",     passwordHash, isSuperAdmin: false },
    { email: "operator@velocityrides.demo",   phone: "+79991000004", phoneVerified: true, firstName: "James",  lastName: "Wilson",   passwordHash, isSuperAdmin: false },
    { email: "mechanic@velocityrides.demo",   phone: "+79991000005", phoneVerified: true, firstName: "Andrei", lastName: "Volkov",   passwordHash, isSuperAdmin: false },
    { email: "viewer@velocityrides.demo",     phone: "+79991000006", phoneVerified: true, firstName: "Emma",   lastName: "Park",     passwordHash, isSuperAdmin: false },
    { email: "accountant@velocityrides.demo", phone: "+79991000007", phoneVerified: true, firstName: "Lucia",  lastName: "Fernandez",passwordHash, isSuperAdmin: false },
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
        roleId,
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
      type: "rental_payment" as const,
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
      contactPerson: "Lisa Wang",
      phone: "+1-555-9001",
      email: "lisa@techcorp.demo",
      requestedFleetSize: 50,
      assetTypes: ["ebike"],
      message: "Need fleet of ebikes for campus transport",
      status: "negotiating",
    },
    {
      companyId: demoCompany.id,
      companyName: "Hotel Marina",
      contactPerson: "Roberto Silva",
      phone: "+1-555-9002",
      email: "roberto@hotelmarina.demo",
      requestedFleetSize: 20,
      assetTypes: ["scooter"],
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

  const deviceProviders = ["teltonika", "abus", "generic", "ninebot"];
  const deviceData = Array.from({ length: 10 }, (_, i) => ({
    companyId: demoCompany.id,
    deviceType: (["gps_tracker", "smart_lock", "battery_bms", "controller", "gps_tracker"] as const)[i % 5],
    provider: deviceProviders[i % 4],
    externalId: `EXT-DEV-${String(1000 + i)}`,
    serialNumber: `DEV-${String(1000 + i)}`,
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

  const now = new Date();
  const telSnaps = insertedDevices.slice(0, 5).map((d, i) => ({
    deviceId: d.id,
    companyId: demoCompany.id,
    lat: 40.7128 + (i * 0.01),
    lng: -74.006 + (i * 0.01),
    speed: i * 5,
    batteryPercent: 100 - i * 15,
    onlineState: i < 4 ? "online" : "offline",
    payload: { demo: true },
    recordedAt: now,
  }));
  await db.insert(telemetrySnapshots).values(telSnaps);
  console.log(`  Telemetry snapshots: ${telSnaps.length}`);

  const telEvents = insertedDevices.slice(0, 5).flatMap((d, i) => [
    {
      deviceId: d.id,
      companyId: demoCompany.id,
      eventType: "online" as const,
      severity: "info" as const,
      payload: {},
      recordedAt: now,
    },
    {
      deviceId: d.id,
      companyId: demoCompany.id,
      eventType: i === 4 ? "low_battery" as const : "location_update" as const,
      severity: i === 4 ? "warning" as const : "info" as const,
      payload: {},
      recordedAt: now,
    },
  ]);
  await db.insert(telemetryEvents).values(telEvents);
  console.log(`  Telemetry events: ${telEvents.length}`);

  // ─── Platform admin users ────────────────────────────────────────────────
  const platformUserData = [
    { email: "superadmin@platform.demo",    phone: "+79990000001", phoneVerified: true, firstName: "Alex",  lastName: "Platform", passwordHash, isSuperAdmin: true  as const },
    { email: "platformadmin@platform.demo", phone: "+79990000002", phoneVerified: true, firstName: "Diana", lastName: "Admin",    passwordHash, isSuperAdmin: false as const },
    { email: "support@platform.demo",       phone: "+79990000003", phoneVerified: true, firstName: "Kevin", lastName: "Support",  passwordHash, isSuperAdmin: false as const },
    { email: "finance@platform.demo",       phone: "+79990000004", phoneVerified: true, firstName: "Olga",  lastName: "Finance",  passwordHash, isSuperAdmin: false as const },
  ];
  const insertedPlatformUsers = await db.insert(users).values(platformUserData).returning();
  console.log(`  Platform users: ${insertedPlatformUsers.map(u => u.email).join(", ")}`);

  const getPlatformRoleId = async (code: string) => {
    const [r] = await db.select().from(platformRoles).where(eq(platformRoles.code, code)).limit(1);
    if (!r) throw new Error(`Platform role '${code}' not found. Run seed-rbac first.`);
    return r.id;
  };

  const platformRoleAssignments = [
    { userIdx: 0, code: "superAdmin" },
    { userIdx: 1, code: "platformAdmin" },
    { userIdx: 2, code: "platformSupport" },
    { userIdx: 3, code: "platformFinance" },
  ];
  for (const { userIdx, code } of platformRoleAssignments) {
    const platformRoleId = await getPlatformRoleId(code);
    await db.insert(platformUserRoles).values({
      userId: insertedPlatformUsers[userIdx].id,
      platformRoleId,
    });
  }
  console.log("  Platform role assignments: done");

  // ─── Second demo company ─────────────────────────────────────────────────
  const [company2] = await db.insert(companies).values({
    name: "Urban Wheels",
    slug: "urban-wheels",
    legalName: "Urban Wheels SRL",
    email: "info@urbanwheels.demo",
    phone: "+44-20-7946-0200",
    country: "GB",
    currency: "GBP",
    timezone: "Europe/London",
    status: "trial",
  }).returning();
  console.log(`  Company 2: ${company2.name} (${company2.id})`);

  const [uwBranch] = await db.insert(branches).values({
    name: "City Centre",
    companyId: company2.id,
  }).returning();

  const [uwOwner] = await db.insert(users).values({
    email: "owner@urbanwheels.demo",
    phone: "+79991000008",
    phoneVerified: true,
    firstName: "Luca",
    lastName: "Bianchi",
    passwordHash,
    isSuperAdmin: false,
  }).returning();

  const ownerRoleId = await getRoleId("owner");
  await db.insert(userCompanyMemberships).values({
    userId: uwOwner.id,
    companyId: company2.id,
    roleId: ownerRoleId,
    status: "active",
  });

  const uwAssetData = Array.from({ length: 10 }, (_, i) => ({
    companyId: company2.id,
    branchId: uwBranch.id,
    assetType: (["bike", "ebike", "scooter", "escooter"] as const)[i % 4],
    brand: ["Trek", "Xiaomi"][i % 2],
    model: ["City 3", "Mi Electric"][i % 2],
    serialNumber: `UW-SN-${String(100 + i)}`,
    internalCode: `UW-${String(i + 1).padStart(3, "0")}`,
    status: i < 7 ? "available" as const : "maintenance" as const,
    isPublic: true,
  }));
  await db.insert(assets).values(uwAssetData);
  console.log(`  Urban Wheels assets: ${uwAssetData.length}`);

  console.log("\n✅ Demo seed complete!");
  console.log("\n╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║           DEMO CREDENTIALS  (phone login, password: demo1234)           ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  PLATFORM ADMIN                                                          ║");
  console.log("║  +7 999 000 0001  (Super Admin)        superadmin@platform.demo          ║");
  console.log("║  +7 999 000 0002  (Platform Admin)     platformadmin@platform.demo       ║");
  console.log("║  +7 999 000 0003  (Support)            support@platform.demo             ║");
  console.log("║  +7 999 000 0004  (Finance)            finance@platform.demo             ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  VELOCITY RIDES (active tenant, US)                                      ║");
  console.log("║  +7 999 100 0001  (Owner)              owner@velocityrides.demo          ║");
  console.log("║  +7 999 100 0002  (Admin)              admin@velocityrides.demo          ║");
  console.log("║  +7 999 100 0003  (Manager)            manager@velocityrides.demo        ║");
  console.log("║  +7 999 100 0004  (Operator)           operator@velocityrides.demo       ║");
  console.log("║  +7 999 100 0005  (Mechanic)           mechanic@velocityrides.demo       ║");
  console.log("║  +7 999 100 0006  (Viewer)             viewer@velocityrides.demo         ║");
  console.log("║  +7 999 100 0007  (Accountant)         accountant@velocityrides.demo     ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════╣");
  console.log("║  URBAN WHEELS (trial tenant, UK)                                         ║");
  console.log("║  +7 999 100 0008  (Owner)              owner@urbanwheels.demo            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝");
}

async function main() {
  const mode = process.argv[2] ?? "demo";

  if (mode === "demo") {
    await seedDemo();
  } else if (mode === "reset") {
    console.log("🔄 Resetting all demo data...");
    const { sql } = await import("drizzle-orm");

    const demoSlugs = ["velocity-rides", "urban-wheels"];
    for (const slug of demoSlugs) {
      const [existing] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
      if (existing) {
        const tables = await db.execute<{ tablename: string }>(
          sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('__drizzle_migrations', 'roles', 'permissions', 'role_permissions', 'platform_roles', 'saas_plans')`,
        );
        for (const { tablename } of tables.rows) {
          try {
            await db.execute(sql.raw(`DELETE FROM "${tablename}" WHERE company_id = '${existing.id}'`));
          } catch {}
        }
        await db.execute(sql.raw(`DELETE FROM "users" WHERE email LIKE '%@${slug.replace("-", "")}.demo' OR email LIKE '%@${slug.split("-").join("")}.demo'`));
        await db.execute(sql.raw(`DELETE FROM "companies" WHERE id = '${existing.id}'`));
        console.log(`  Cleared: ${slug}`);
      }
    }

    await db.execute(sql`
      DELETE FROM "platform_user_roles"
      WHERE user_id IN (
        SELECT id FROM "users"
        WHERE email LIKE '%@platform.demo'
           OR email LIKE '%@velocityrides.demo'
           OR email LIKE '%@urbanwheels.demo'
      )
    `);
    await db.execute(sql`DELETE FROM "users" WHERE email LIKE '%@platform.demo' OR email LIKE '%@velocityrides.demo' OR email LIKE '%@urbanwheels.demo'`);
    console.log("  Platform users cleared.");
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
