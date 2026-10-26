const prisma = require("../db");
const { HttpError } = require("../validation");
const { paginate } = require("../utils/pagination");
const { likeCount, postRelations } = require("../utils/relations");

const createUser = (data) => prisma.user.create({ data });
async function listUsers(options) {
  const { isPrivate, hasPosts, search, sortBy, order, skip, take } = options;
  const where = {};
  if (isPrivate !== undefined) where.isPrivate = isPrivate;
  if (hasPosts !== undefined) where.posts = hasPosts ? { some: {} } : { none: {} };
  if (search !== undefined) where.OR = [
    { username: { contains: search, mode: "insensitive" } },
    { fullname: { contains: search, mode: "insensitive" } },
  ];
  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({ where, orderBy: [{ [sortBy]: order }, { id: "desc" }], skip, take }),
    prisma.user.count({ where }),
  ]);
  return paginate(data, total, options);
}
const getUserById = (id) => prisma.user.findUnique({
  where: { id }, include: { _count: { select: { posts: true, likes: true } } },
});
const updateUser = (id, data) => prisma.user.update({ where: { id }, data });
const deleteUser = (id) => prisma.user.delete({ where: { id } });

async function requireUser(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new HttpError(404, "User not found");
}
async function listUserPosts(id, options) {
  await requireUser(id);
  const where = { authorId: id };
  const [data, total] = await prisma.$transaction([
    prisma.post.findMany({ where, include: likeCount, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: options.skip, take: options.take }),
    prisma.post.count({ where }),
  ]);
  return paginate(data, total, options);
}
async function listLikedPosts(id, options) {
  await requireUser(id);
  const where = { likes: { some: { userId: id } } };
  const [data, total] = await prisma.$transaction([
    prisma.post.findMany({ where, include: postRelations, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: options.skip, take: options.take }),
    prisma.post.count({ where }),
  ]);
  return paginate(data, total, options);
}

module.exports = { createUser, listUsers, getUserById, updateUser, deleteUser, listUserPosts, listLikedPosts };
