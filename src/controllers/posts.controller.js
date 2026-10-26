const { parsePagination } = require("../utils/pagination");
const { parseSort, parseText, parseDate } = require("../utils/query");
const posts = require("../services/posts.service");
const { HttpError, requireStrings, requireId, pickFields } = require("../validation");

async function create(req, res) {
  requireStrings(req.body, ["imageUrl"], "imageUrl and authorId are required");
  if (req.body?.authorId == null) throw new HttpError(400, "imageUrl and authorId are required");
  const authorId = requireId(req.body.authorId, "authorId");
  const data = pickFields(req.body, {
    imageUrl: "string", caption: "nullableString", location: "nullableString",
  });
  res.status(201).json(await posts.createPost({ ...data, authorId }));
}

async function list(req, res) {
  const options = {
    ...parsePagination(req.query),
    ...parseSort(req.query, ["createdAt", "updatedAt", "likes"]),
    location: parseText(req.query.location, "location"),
    search: parseText(req.query.search, "search"),
    from: parseDate(req.query.from),
    to: parseDate(req.query.to),
  };
  res.status(200).json(await posts.listPosts(options));
}

async function getOne(req, res) {
  const post = await posts.getPostById(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.status(200).json(post);
}

async function update(req, res) {
  const data = pickFields(req.body, { caption: "nullableString", location: "nullableString" });
  res.status(200).json(await posts.updatePost(Number(req.params.id), data));
}

async function remove(req, res) {
  await posts.deletePost(Number(req.params.id));
  res.status(204).end();
}

module.exports = { create, list, getOne, update, remove };
