const { HttpError } = require("../validation");
const message = "page and limit must be positive integers";

function positiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new HttpError(400, message);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new HttpError(400, message);
  return number;
}

function parsePagination(query) {
  const page = positiveInteger(query.page, 1);
  const limit = Math.min(positiveInteger(query.limit, 10), 50);
  const offset = (page - 1) * limit;
  // Prisma's skip is a signed 32-bit integer. Very distant pages are empty.
  return { page, limit, skip: Math.min(offset, 2147483647), take: offset > 2147483647 ? 0 : limit };
}

function paginate(data, total, { page, limit }) {
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

module.exports = { parsePagination, paginate };
