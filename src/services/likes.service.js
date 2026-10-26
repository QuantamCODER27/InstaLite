const prisma = require("../db");
const { HttpError } = require("../validation");
const { userSummary } = require("../utils/relations");

async function requirePost(postId) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new HttpError(404, "Post not found");
}
async function listLikes(postId) {
  await requirePost(postId);
  return prisma.user.findMany({
    where: { likes: { some: { postId } } }, select: userSummary, orderBy: { username: "asc" },
  });
}
async function createLike(postId, userId) {
  await requirePost(postId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new HttpError(404, "User not found");
  try {
    // The composite key handles competing requests atomically.
    return await prisma.like.create({ data: { userId, postId } });
  } catch (error) {
    if (error.code === "P2002") throw new HttpError(409, "Already liked");
    if (error.code === "P2003") {
      // A user or post may have been deleted between the checks and insert.
      await requirePost(postId);
      throw new HttpError(404, "User not found");
    }
    throw error;
  }
}
async function deleteLike(postId, userId) {
  try {
    return await prisma.like.delete({ where: { userId_postId: { userId, postId } } });
  } catch (error) {
    if (error.code === "P2025") throw new HttpError(404, "Like not found");
    throw error;
  }
}
module.exports = { listLikes, createLike, deleteLike };
