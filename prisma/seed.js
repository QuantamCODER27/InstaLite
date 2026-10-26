const prisma = require("../src/db");
const { users, posts, likes } = require("./seed-data");

async function seed() {
  const counts = await prisma.$transaction(async (tx) => {
    await tx.like.deleteMany();
    await tx.post.deleteMany();
    await tx.user.deleteMany();
    const createdUsers = await tx.user.createManyAndReturn({ data: users });
    const userIds = new Map(createdUsers.map(user => [user.username, user.id]));
    const createdPosts = await tx.post.createManyAndReturn({
      data: posts.map(({ author, ...post }) => ({ ...post, authorId: userIds.get(author) })),
    });
    const postIds = new Map(createdPosts.map(post => [post.imageUrl.split("/")[4], post.id]));
    const createdLikes = await tx.like.createMany({
      data: likes.map(({ user, post }) => ({ userId: userIds.get(user), postId: postIds.get(post) })),
    });
    return { users: createdUsers.length, posts: createdPosts.length, likes: createdLikes.count };
  });
  console.log(`🌱 Seeded ${counts.users} users, ${counts.posts} posts and ${counts.likes} likes`);
  return counts;
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
module.exports = { seed };
