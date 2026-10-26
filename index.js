// Keep the original entry point working as well as npm start.
const { start } = require("./src/index");
start().catch((error) => {
  console.error("Server failed to start:", error.message);
  process.exitCode = 1;
});
