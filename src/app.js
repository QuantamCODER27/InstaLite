const express = require("express");
const usersRouter = require("./routes/users.routes");
const postsRouter = require("./routes/posts.routes");
const errorHandler = require("./middleware/error-handler");

const app = express();
app.use(express.json());
app.get("/health", (req, res) => res.status(200).json({ status: "OK" }));
app.use("/users", usersRouter);
app.use("/posts", postsRouter);
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use(errorHandler);

module.exports = app;
