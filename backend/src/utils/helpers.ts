import { prisma } from '../config/prisma';

/**
 * Generate a unique username from a first name.
 * If "Rahul" is taken, tries "Rahul2", "Rahul3", etc.
 */
export async function generateUniqueUsername(firstName: string): Promise<string> {
  // Sanitize: keep only letters/numbers, capitalize first letter
  const base = firstName.trim().replace(/[^a-zA-Z0-9]/g, '');
  if (!base) {
    throw new Error('Invalid name for username generation.');
  }
  // Capitalize first letter
  const baseUsername = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();

  // Check if base is available
  const exists = await prisma.user.findUnique({ where: { username: baseUsername } });
  if (!exists) return baseUsername;

  // Try numbered suffixes
  for (let i = 2; i <= 999; i++) {
    const candidate = `${baseUsername}${i}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate } });
    if (!taken) return candidate;
  }

  throw new Error(`Unable to generate a unique username for "${firstName}". Please contact administration.`);
}

/**
 * Paginate results helper
 */
export function getPaginationParams(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query['limit'] ?? '20'), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

/**
 * Format pagination response
 */
export function paginateResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
}
