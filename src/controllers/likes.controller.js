const likes = require("../services/likes.service");
const { HttpError, requireId } = require("../validation");

async function list(req, res) {
  res.status(200).json(await likes.listLikes(Number(req.params.id)));
}
async function create(req, res) {
  if (req.body?.userId == null) throw new HttpError(400, "userId is required");
  const userId = requireId(req.body.userId, "userId");
  res.status(201).json(await likes.createLike(Number(req.params.id), userId));
}
async function remove(req, res) {
  await likes.deleteLike(Number(req.params.id), Number(req.params.userId));
  res.status(204).end();
}
module.exports = { list, create, remove };
