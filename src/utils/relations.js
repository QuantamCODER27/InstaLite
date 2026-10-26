// Every nested user is limited to this public summary.
const userSummary = { id: true, username: true, fullname: true };
const likeCount = { _count: { select: { likes: true } } };
const postRelations = { author: { select: userSummary }, ...likeCount };

module.exports = { userSummary, likeCount, postRelations };
