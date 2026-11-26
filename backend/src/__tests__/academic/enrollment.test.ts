/**
 * Bulk student import: copy/paste parsing and username collision resolution.
 *
 * These are the two deterministic pieces behind the admin bulk-import wizard.
 * DB writes are exercised by the E2E/CI seed; here we lock down row parsing and
 * the suffix strategy that prevents `aarav`, `aarav2`, `aarav3` collisions.
 */

process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["DIRECT_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["SUPABASE_URL"] = "https://test.supabase.co";
process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key";
process.env["JWT_SECRET"] = "super-secret-test-key-for-jest-enrollment-tests";

jest.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

import {
  parseStudentBulkText,
  generateUniqueUsername,
} from "../../routes/admin/students";
import { prisma } from "../../config/prisma";

const mockFindUser = prisma.user.findUnique as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parseStudentBulkText()", () => {
  it("parses tab-separated student rows and preserves row numbers", () => {
    const result = parseStudentBulkText(
      ["Aarav Sharma\t12345678", "Diya\t87654321"].join("\n")
    );

    expect(result.invalid).toHaveLength(0);
    expect(result.valid).toEqual([
      { firstName: "Aarav", lastName: "Sharma", prn: "12345678", rowNumber: 1 },
      { firstName: "Diya", lastName: "", prn: "87654321", rowNumber: 2 },
    ]);
  });

  it("accepts multiple spaces, extra columns, and middle names", () => {
    const result = parseStudentBulkText("Ravi  Kumar  Rao   1234567890");

    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0]).toEqual({
      firstName: "Ravi",
      lastName: "Kumar Rao",
      prn: "1234567890",
      rowNumber: 1,
    });
  });

  it("ignores blank lines when numbering parsed rows", () => {
    const result = parseStudentBulkText("\n\nAarav Sharma\t12345678\n\n");

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].rowNumber).toBe(1);
  });

  it("rejects rows without a usable PRN", () => {
    const result = parseStudentBulkText(
      ["No Prn Here", "Short 123", "Alphabetic  PRN12345678"].join("\n")
    );

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(3);
    expect(result.invalid[0].reason).toMatch(/at least a name and PRN/i);
    expect(result.invalid[1].reason).toMatch(/at least a name and PRN/i);
    expect(result.invalid[2].reason).toMatch(/valid PRN/i);
  });

  it("rejects a row that only contains a PRN", () => {
    const result = parseStudentBulkText("12345678");

    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].reason).toMatch(/at least a name and PRN/i);
  });
});

describe("generateUniqueUsername()", () => {
  it("uses the cleaned first name when it is free", async () => {
    mockFindUser.mockResolvedValueOnce(null);

    await expect(generateUniqueUsername("Aarav")).resolves.toBe("aarav");
    expect(mockFindUser).toHaveBeenCalledWith({ where: { username: "aarav" } });
  });

  it("appends an incrementing suffix until a free username is found", async () => {
    mockFindUser
      .mockResolvedValueOnce({ id: "1" }) // aarav taken
      .mockResolvedValueOnce({ id: "2" }) // aarav2 taken
      .mockResolvedValueOnce(null); // aarav3 free

    await expect(generateUniqueUsername("Aarav")).resolves.toBe("aarav3");
    expect(mockFindUser).toHaveBeenCalledTimes(3);
    expect(mockFindUser.mock.calls.map((call) => call[0].where.username)).toEqual([
      "aarav",
      "aarav2",
      "aarav3",
    ]);
  });

  it("strips punctuation and whitespace before probing the database", async () => {
    mockFindUser.mockResolvedValueOnce(null);

    await expect(generateUniqueUsername("  Aarav-Kumar! ")).resolves.toBe("aaravkumar");
    expect(mockFindUser).toHaveBeenCalledWith({ where: { username: "aaravkumar" } });
  });
});
