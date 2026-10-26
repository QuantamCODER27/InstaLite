const app = require("./app");
const prisma = require("./db");

async function start() {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connection successful");
  const server = app.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
  server.on("error", async (error) => {
    console.error("Server failed to start:", error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } finally {
        clearTimeout(timeout);
      }
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error("Server failed to start:", error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}

module.exports = { start };
