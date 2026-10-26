const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Set DATABASE_URL to a PostgreSQL connection URL in .env");
}
if (!/^postgres(?:ql)?:\/\//.test(connectionString)) {
  throw new Error(
    "The pg adapter requires a postgresql:// URL. Set DIRECT_DATABASE_URL to your database's direct connection URL."
  );
}

const max = Number(process.env.PG_POOL_MAX || 10);
if (!Number.isInteger(max) || max < 1) throw new Error("PG_POOL_MAX must be a positive integer");
const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, max });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
