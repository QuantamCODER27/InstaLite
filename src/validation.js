class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireStrings(body, fields, message) {
  if (fields.some((field) => typeof body?.[field] !== "string" || !body[field].trim())) {
    throw new HttpError(400, message);
  }
}

// Select fields explicitly so clients cannot change IDs, timestamps, or other fields.
function pickFields(body = {}, fields) {
  const data = {};
  for (const [field, type] of Object.entries(fields)) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field];
    if (type === "nullableString" && value === null) {
      data[field] = null;
      continue;
    }
    const expected = type === "nullableString" ? "string" : type;
    if (typeof value !== expected || (expected === "string" && type !== "nullableString" && !value.trim())) {
      throw new HttpError(400, `${field} must be ${expected === "boolean" ? "a boolean" : type === "nullableString" ? "a string or null" : "a non-empty string"}`);
    }
    data[field] = value;
  }
  return data;
}

function requireId(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new HttpError(400, `${name} must be a positive 32-bit integer`);
  }
  return value;
}

module.exports = { HttpError, requireStrings, requireId, pickFields };
