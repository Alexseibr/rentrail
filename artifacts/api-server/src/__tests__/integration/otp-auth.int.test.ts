import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { db, users, phoneOtpCodes } from "@workspace/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import {
  testApp,
  acquireTestLock,
  cleanDatabase,
  clearRolesCache,
  seedRolesAndPermissions,
  resBody,
  type ApiResponse,
} from "../helpers";

const HOOK_TIMEOUT = 30_000;

const TEST_PHONE = "+79001112233";
const OTHER_PHONE = "+79009998877";
const NO_PASS_PHONE = "+79005550001";

async function insertUserWithPhone(phone: string): Promise<string> {
  const passwordHash = await bcrypt.hash("TestPass123!", 4);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const [user] = await db
    .insert(users)
    .values({
      phone,
      email: `otp-user-${suffix}@test.com`,
      passwordHash,
      firstName: "OTP",
      lastName: "User",
    })
    .returning();
  return user.id;
}

async function insertUserWithoutPassword(phone: string): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const [user] = await db
    .insert(users)
    .values({
      phone,
      email: `otp-nopass-${suffix}@test.com`,
      passwordHash: null,
      firstName: "NoPass",
      lastName: "User",
    })
    .returning();
  return user.id;
}

async function clearOtpRecords(): Promise<void> {
  await db.delete(phoneOtpCodes);
}

async function readOldestValidOtp(phone: string): Promise<string> {
  const now = new Date();
  const [record] = await db
    .select()
    .from(phoneOtpCodes)
    .where(
      and(
        eq(phoneOtpCodes.phone, phone),
        isNull(phoneOtpCodes.usedAt),
        gt(phoneOtpCodes.expiresAt, now),
      ),
    )
    .orderBy(phoneOtpCodes.createdAt)
    .limit(1);
  if (!record) throw new Error("No valid OTP found in DB for phone: " + phone);
  return record.code;
}

describe("OTP Auth — integration", () => {
  let _unlock: (() => void) | undefined;

  beforeAll(async () => {
    _unlock = await acquireTestLock();
    await cleanDatabase();
    clearRolesCache();
    await seedRolesAndPermissions();
    await insertUserWithPhone(TEST_PHONE);
    await insertUserWithoutPassword(NO_PASS_PHONE);
  }, HOOK_TIMEOUT);

  afterAll(() => {
    _unlock?.();
  }, HOOK_TIMEOUT);

  // ─── POST /api/auth/phone/request-otp ────────────────────────────────────────

  describe("POST /api/auth/phone/request-otp", () => {
    it("returns sent:true and a 6-digit devCode for a registered phone", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: TEST_PHONE });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(data.sent).toBe(true);
      expect(typeof data.devCode).toBe("string");
      expect((data.devCode as string).length).toBe(6);
    });

    it("creates an OTP record in the database", async () => {
      const before = Date.now();

      await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: TEST_PHONE });

      const records = await db
        .select()
        .from(phoneOtpCodes)
        .orderBy(phoneOtpCodes.createdAt);

      const recent = records.filter(
        (r) => r.phone === TEST_PHONE && r.createdAt.getTime() >= before,
      );

      expect(recent.length).toBeGreaterThanOrEqual(1);
      expect(recent[0].usedAt).toBeNull();
      expect(recent[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns 404 for an unregistered phone number", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: "+70000000000" });

      expect(res.status).toBe(404);
    });

    it("returns 4xx for a missing phone field", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({});

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 4xx for a too-short phone value", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: "123" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── POST /api/auth/phone/verify-otp ─────────────────────────────────────────
  //
  // Each sub-test clears the phoneOtpCodes table first, then requests a fresh
  // OTP, then reads the code directly from the DB — matching exactly what the
  // server does (it picks the oldest unused, unexpired record).
  //

  describe("POST /api/auth/phone/verify-otp — correct code", () => {
    beforeEach(async () => {
      await clearOtpRecords();
    }, HOOK_TIMEOUT);

    it("returns accessToken, refreshToken, user, and needsPassword on valid code", async () => {
      await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: TEST_PHONE });

      const code = await readOldestValidOtp(TEST_PHONE);

      const verifyRes = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code });

      expect(verifyRes.status).toBe(200);
      const data = resBody<ApiResponse>(verifyRes).data;
      expect(typeof data.accessToken).toBe("string");
      expect(typeof data.refreshToken).toBe("string");
      expect(data).toHaveProperty("user");
      expect(data).toHaveProperty("needsPassword");
    });

    it("marks the OTP record as used after successful verification", async () => {
      await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: TEST_PHONE });

      const code = await readOldestValidOtp(TEST_PHONE);

      await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code });

      const records = await db
        .select()
        .from(phoneOtpCodes)
        .where(eq(phoneOtpCodes.phone, TEST_PHONE));

      const used = records.find((r) => r.code === code);
      expect(used).toBeDefined();
      expect(used?.usedAt).not.toBeNull();
    });

    it("rejects a second attempt with the already-used code (401)", async () => {
      await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: TEST_PHONE });

      const code = await readOldestValidOtp(TEST_PHONE);

      await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code });

      const reuse = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code });

      expect(reuse.status).toBe(401);
    });
  });

  describe("POST /api/auth/phone/verify-otp — wrong code", () => {
    beforeEach(async () => {
      await clearOtpRecords();
    }, HOOK_TIMEOUT);

    it("returns 401 for an incorrect OTP code", async () => {
      await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone: TEST_PHONE });

      const res = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code: "000000" });

      expect(res.status).toBe(401);
    });

    it("returns 401 for a code with correct length but wrong value", async () => {
      const actualCode = await (async () => {
        await request(testApp)
          .post("/api/auth/phone/request-otp")
          .send({ phone: TEST_PHONE });
        return readOldestValidOtp(TEST_PHONE);
      })();

      const wrongCode = actualCode === "111111" ? "222222" : "111111";

      const res = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code: wrongCode });

      expect(res.status).toBe(401);
    });

    it("returns 4xx for a code that is not 6 characters", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code: "12345" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("POST /api/auth/phone/verify-otp — expired code", () => {
    beforeEach(async () => {
      await clearOtpRecords();
    }, HOOK_TIMEOUT);

    it("returns 401 when the OTP record is already past its expiry", async () => {
      const expiredAt = new Date(Date.now() - 60_000);

      await db.insert(phoneOtpCodes).values({
        phone: TEST_PHONE,
        code: "123456",
        expiresAt: expiredAt,
      });

      const res = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: TEST_PHONE, code: "123456" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/phone/verify-otp — unknown phone", () => {
    beforeEach(async () => {
      await clearOtpRecords();
    }, HOOK_TIMEOUT);

    it("returns 401 when no OTP exists for the given phone", async () => {
      await insertUserWithPhone(OTHER_PHONE).catch(() => {
        // ignore if user already exists from a previous run
      });

      const res = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone: OTHER_PHONE, code: "111111" });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/auth/phone/login ───────────────────────────────────────────────

  describe("POST /api/auth/phone/login", () => {
    it("returns accessToken, refreshToken, and user on valid credentials", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ phone: TEST_PHONE, password: "TestPass123!" });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(typeof data.accessToken).toBe("string");
      expect(typeof data.refreshToken).toBe("string");
      expect(data).toHaveProperty("user");
    });

    it("returns 401 for a wrong password", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ phone: TEST_PHONE, password: "WrongPassword!" });

      expect(res.status).toBe(401);
    });

    it("returns 401 for a user that has no password set", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ phone: NO_PASS_PHONE, password: "AnyPassword1!" });

      expect(res.status).toBe(401);
    });

    it("returns 401 for a phone number that is not registered", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ phone: "+70000000001", password: "SomePassword1!" });

      expect(res.status).toBe(401);
    });

    it("returns 4xx when phone field is missing", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ password: "TestPass123!" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("returns 4xx when password field is missing", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ phone: TEST_PHONE });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ─── POST /api/auth/phone/set-password ───────────────────────────────────────

  describe("POST /api/auth/phone/set-password", () => {
    const SET_PASS_PHONE = "+79007770002";

    async function resetSetPassUser(): Promise<void> {
      await db.delete(users).where(eq(users.phone, SET_PASS_PHONE));
      await insertUserWithoutPassword(SET_PASS_PHONE);
    }

    async function getTokenViaOtp(phone: string): Promise<string> {
      const otpRes = await request(testApp)
        .post("/api/auth/phone/request-otp")
        .send({ phone });
      expect(otpRes.status).toBe(200);

      const code = await readOldestValidOtp(phone);

      const verifyRes = await request(testApp)
        .post("/api/auth/phone/verify-otp")
        .send({ phone, code });
      expect(verifyRes.status).toBe(200);

      const data = resBody<ApiResponse>(verifyRes).data;
      return data.accessToken as string;
    }

    beforeEach(async () => {
      await clearOtpRecords();
      await resetSetPassUser();
    }, HOOK_TIMEOUT);

    it("allows an authenticated user to set a new password", async () => {
      const token = await getTokenViaOtp(SET_PASS_PHONE);

      const res = await request(testApp)
        .post("/api/auth/phone/set-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "NewPassword1!" });

      expect(res.status).toBe(200);
      const data = resBody<ApiResponse>(res).data;
      expect(data).toHaveProperty("message");
    });

    it("allows phone/login to succeed after set-password", async () => {
      const token = await getTokenViaOtp(SET_PASS_PHONE);

      await request(testApp)
        .post("/api/auth/phone/set-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "NewPassword1!" });

      const loginRes = await request(testApp)
        .post("/api/auth/phone/login")
        .send({ phone: SET_PASS_PHONE, password: "NewPassword1!" });

      expect(loginRes.status).toBe(200);
      const loginData = resBody<ApiResponse>(loginRes).data;
      expect(typeof loginData.accessToken).toBe("string");
      expect(typeof loginData.refreshToken).toBe("string");
    });

    it("returns 401 when called without an access token", async () => {
      const res = await request(testApp)
        .post("/api/auth/phone/set-password")
        .send({ password: "NewPassword1!" });

      expect(res.status).toBe(401);
    });

    it("returns 4xx when password is shorter than 6 characters", async () => {
      const token = await getTokenViaOtp(SET_PASS_PHONE);

      const res = await request(testApp)
        .post("/api/auth/phone/set-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "abc" });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
