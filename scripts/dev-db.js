const fs = require("node:fs");
const path = require("node:path");
const { startPrismaDevServer } = require("@prisma/dev");

async function main() {
  // Keep the previous lab's database intact; use a dedicated relations database.
  const database = await startPrismaDevServer({ name: "instalite-relations", persistenceMode: "stateful" });
  const envPath = path.join(__dirname, "../.env");
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const values = {
      DIRECT_DATABASE_URL: database.database.connectionString,
      SHADOW_DATABASE_URL: database.shadowDatabase.connectionString,
      PG_POOL_MAX: "1",
    };
    for (const [key, value] of Object.entries(values)) {
      const line = `${key}=${JSON.stringify(value)}`;
      const pattern = new RegExp(`^${key}\\s*=.*$`, "m");
      content = pattern.test(content) ? content.replace(pattern, () => line) : content + "\n" + line + "\n";
    }
    fs.writeFileSync(envPath, content);
  } catch (error) {
    await database.close();
    throw error;
  }
  console.log('Persistent development database "instalite-relations" is running.');
  console.log("Direct and shadow connection URLs saved to .env. Leave this terminal running.");
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await database.close();
  }
  process.once("SIGINT", () => stop().catch(error => { console.error(error.message); process.exitCode = 1; }));
  process.once("SIGTERM", () => stop().catch(error => { console.error(error.message); process.exitCode = 1; }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
