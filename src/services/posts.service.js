const prisma = require("../db");
const { HttpError } = require("../validation");
const { paginate } = require("../utils/pagination");
const { postRelations } = require("../utils/relations");

async function createPost(data) {
  const author = await prisma.user.findUnique({ where: { id: data.authorId }, select: { id: true } });
  if (!author) throw new HttpError(404, "User not found");
  try {
    return await prisma.post.create({ data });
  } catch (error) {
    // The author could be deleted between the lookup and insert.
    if (error.code === "P2003") throw new HttpError(404, "User not found");
    throw error;
  }
}
async function listPosts(options) {
  const { location, search, from, to, sortBy, order, skip, take } = options;
  const where = {};
  if (location !== undefined) where.location = { equals: location, mode: "insensitive" };
  if (search !== undefined) where.caption = { contains: search, mode: "insensitive" };
  if (from !== undefined || to !== undefined) where.createdAt = {
    ...(from !== undefined && { gte: from }), ...(to !== undefined && { lt: to }),
  };
  const orderBy = sortBy === "likes"
    ? [{ likes: { _count: order } }, { createdAt: "desc" }, { id: "desc" }]
    : [{ [sortBy]: order }, { id: "desc" }];
  const [data, total] = await prisma.$transaction([
    prisma.post.findMany({ where, include: postRelations, orderBy, skip, take }),
    prisma.post.count({ where }),
  ]);
  return paginate(data, total, options);
}
const getPostById = (id) => prisma.post.findUnique({ where: { id }, include: postRelations });
const updatePost = (id, data) => prisma.post.update({ where: { id }, data });
const deletePost = (id) => prisma.post.delete({ where: { id } });

module.exports = { createPost, listPosts, getPostById, updatePost, deletePost };
