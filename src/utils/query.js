const { HttpError } = require("../validation");

function parseSort(query, allowed) {
  const sortBy = query.sortBy === undefined ? "createdAt" : query.sortBy;
  const order = query.order === undefined ? "desc" : query.order;
  if (!allowed.includes(sortBy)) throw new HttpError(400, `sortBy must be one of: ${allowed.join(", ")}`);
  if (!["asc", "desc"].includes(order)) throw new HttpError(400, "order must be asc or desc");
  return { sortBy, order };
}

function parseBoolean(value, name) {
  if (value === undefined) return undefined;
  if (value !== "true" && value !== "false") throw new HttpError(400, `${name} must be true or false`);
  return value === "true";
}

function parseText(value, name) {
  if (value !== undefined && typeof value !== "string") throw new HttpError(400, `${name} must be a string`);
  return value;
}

function parseDate(value) {
  if (value === undefined) return undefined;
  const error = () => { throw new HttpError(400, "from and to must be valid dates"); };
  if (typeof value !== "string" || !value.trim()) return error();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return error();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (iso) {
    const [, year, month, day] = iso.map(Number);
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return error();
  }
  return date;
}

module.exports = { parseSort, parseBoolean, parseText, parseDate };
