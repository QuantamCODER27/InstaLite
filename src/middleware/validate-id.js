module.exports = (resource) => (req, res, next, id) => {
  res.locals.resource = resource;
  if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ error: "id must be a positive 32-bit integer" });
  }
  next();
};
