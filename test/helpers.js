const { before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFile, readdir } = require("node:fs/promises");
const path = require("node:path");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
let prisma, database, databaseServer, server, baseUrl;
const originalPoolMax = process.env.PG_POOL_MAX;
const originalUrl = process.env.DATABASE_URL;
const originalDirectUrl = process.env.DIRECT_DATABASE_URL;

function setup({ seeded = false } = {}) {
  before(async () => {
    database = await PGlite.create();
    const migrations = path.join(__dirname, "../prisma/migrations");
    for (const entry of (await readdir(migrations, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await database.exec(await readFile(path.join(migrations, entry.name, "migration.sql"), "utf8"));
    }
    databaseServer = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port: 0 });
    await databaseServer.start();
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${databaseServer.getServerConn()}/postgres?sslmode=disable`;
    process.env.DIRECT_DATABASE_URL = process.env.DATABASE_URL;
    // PGlite has one underlying database session; use one physical connection.
    process.env.PG_POOL_MAX = "1";
    prisma = require("../src/db");
    await prisma.$connect();
    server = require("../src/app").listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  beforeEach(async () => {
    if (seeded) await require("../prisma/seed").seed();
    else {
      if (prisma.like) await prisma.like.deleteMany();
      await prisma.post.deleteMany();
      await prisma.user.deleteMany();
    }
  });
  after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (prisma) await prisma.$disconnect();
    if (databaseServer) await databaseServer.stop();
    if (database) await database.close();
    if (originalPoolMax === undefined) delete process.env.PG_POOL_MAX;
    else process.env.PG_POOL_MAX = originalPoolMax;
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalDirectUrl === undefined) delete process.env.DIRECT_DATABASE_URL;
    else process.env.DIRECT_DATABASE_URL = originalDirectUrl;
  });
}
async function request(method, route, body, raw = false) {
  const response = await fetch(baseUrl + route, {
    method, headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await response.text();
  if (text) assert.match(response.headers.get("content-type"), /application\/json/);
  return { status: response.status, body: text ? JSON.parse(text) : undefined, text };
}
function expectError(result, status, error) {
  assert.equal(result.status, status);
  assert.deepEqual(result.body, { error });
}
async function command(executable, args) {
  const child = spawn(executable, args, { cwd: path.join(__dirname, ".."), env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const timeout = setTimeout(() => child.kill("SIGTERM"), 20000);
  const [code] = await once(child, "exit");
  clearTimeout(timeout);
  assert.equal(code, 0, output);
  return output;
}
module.exports = { setup, request, expectError, command, get prisma() { return prisma; } };
