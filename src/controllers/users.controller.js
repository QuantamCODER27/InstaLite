const { parsePagination } = require("../utils/pagination");
const { parseSort, parseBoolean, parseText } = require("../utils/query");
const users = require("../services/users.service");
const { requireStrings, pickFields } = require("../validation");

async function create(req, res) {
  requireStrings(req.body, ["username", "email", "fullname"], "username, email and fullname are required");
  const data = pickFields(req.body, {
    username: "string", email: "string", fullname: "string", bio: "nullableString",
  });
  res.status(201).json(await users.createUser(data));
}

async function list(req, res) {
  const options = {
    ...parsePagination(req.query),
    ...parseSort(req.query, ["createdAt", "username", "fullname"]),
    isPrivate: parseBoolean(req.query.isPrivate, "isPrivate"),
    hasPosts: parseBoolean(req.query.hasPosts, "hasPosts"),
    search: parseText(req.query.search, "search"),
  };
  res.status(200).json(await users.listUsers(options));
}

async function getOne(req, res) {
  const user = await users.getUserById(Number(req.params.id));
  if (!user) return res.status(404).json({ error: "User not found" });
  res.status(200).json(user);
}

async function update(req, res) {
  const data = pickFields(req.body, {
    fullname: "string", bio: "nullableString", isPrivate: "boolean",
  });
  res.status(200).json(await users.updateUser(Number(req.params.id), data));
}

async function remove(req, res) {
  await users.deleteUser(Number(req.params.id));
  res.status(204).end();
}

async function getPosts(req, res) {
  const options = parsePagination(req.query);
  res.status(200).json(await users.listUserPosts(Number(req.params.id), options));
}
async function getLikedPosts(req, res) {
  const options = parsePagination(req.query);
  res.status(200).json(await users.listLikedPosts(Number(req.params.id), options));
}

module.exports = { create, list, getOne, update, remove, getPosts, getLikedPosts };
