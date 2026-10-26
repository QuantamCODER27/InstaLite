module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === "P2002") {
    return res.status(409).json({ error: "username or email already taken" });
  }
  if (error.code === "P2025") {
    return res.status(404).json({ error: `${res.locals.resource} not found` });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Request failed:", error);
  res.status(500).json({ error: "Internal server error" });
};
