const { test } = require("node:test");
const assert = require("node:assert/strict");
const api = require("./helpers");
api.setup({ seeded: true });
const { request, expectError } = api;
const user = username => api.prisma.user.findUnique({ where: { username } });
const post = key => api.prisma.post.findFirst({ where: { imageUrl: { contains: `/${key}/` } } });
const keys = rows => rows.map(row => row.imageUrl.split("/")[4]);
const names = rows => rows.map(row => row.username);
function summary(value) { assert.deepEqual(Object.keys(value).sort(), ["fullname", "id", "username"]); }
async function get(route) { const response = await request("GET", route); assert.equal(response.status,200,route); return response.body; }
const meta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total/limit) });

test("related seed resolves every author and like through real generated IDs", async () => {
  assert.equal(await api.prisma.user.count(),12);
  assert.equal(await api.prisma.post.count(),24);
  assert.equal(await api.prisma.like.count(),29);
  const seeded = require("../prisma/seed-data");
  const rows = await api.prisma.post.findMany({ include: { author: true } });
  for (const expected of seeded.posts) {
    const actual = rows.find(row=>row.imageUrl === expected.imageUrl);
    assert.equal(actual.author.username, expected.author);
    assert.equal(actual.createdAt.toISOString(), expected.createdAt);
    assert.equal(actual.caption, expected.caption);
    assert.equal(actual.location, expected.location);
  }
  const likes = await api.prisma.like.findMany({ include: { user: true, post: true } });
  assert.deepEqual(likes.map(like=>`${like.user.username}:${like.post.imageUrl.split("/")[4]}`).sort(), seeded.likes.map(like=>`${like.user}:${like.post}`).sort());
});

test("post creation requires an existing author and PATCH cannot change authors", async () => {
  const riya = await user("riya_travels");
  const arjun = await user("arjun_clicks");
  const created = await request("POST","/posts",{ imageUrl:"https://example.com/new.jpg",caption:"First post!",authorId:riya.id,id:999999 });
  assert.equal(created.status,201);
  assert.equal(created.body.authorId,riya.id);
  assert.notEqual(created.body.id,999999);
  for(const body of [{imageUrl:"https://example.com/new.jpg"},{authorId:riya.id},{}])
    expectError(await request("POST","/posts",body),400,"imageUrl and authorId are required");
  expectError(await request("POST","/posts",{imageUrl:"https://example.com/new.jpg",authorId:2147483647}),404,"User not found");
  const first = await post("insta01");
  const changed = await request("PATCH",`/posts/${first.id}`,{caption:"Baga, again 🌅",authorId:arjun.id,imageUrl:"changed"});
  assert.equal(changed.status,200);
  assert.equal(changed.body.caption,"Baga, again 🌅");
  assert.equal(changed.body.authorId,riya.id);
  assert.equal(changed.body.imageUrl,first.imageUrl);
});

test("single posts include only the public author summary and correct like counts", async () => {
  for(const [key,author,count] of [["insta01","riya_travels",5],["insta24","dev_shoots",6],["insta05","arjun_clicks",0]]) {
    const item = await post(key);
    const body = await get(`/posts/${item.id}`);
    assert.equal(body.author.username,author);
    assert.deepEqual(body._count,{likes:count});
    summary(body.author);
    assert.equal(JSON.stringify(body).includes('"email"'),false);
  }
  expectError(await request("GET","/posts/2147483647"),404,"Post not found");
});

test("post lists include relations and sort likes with newest-first ties in both directions", async () => {
  for(const [query,expected,counts,total] of [
    ["limit=2",["insta24","insta23"],[6,0],24],
    ["sortBy=likes&limit=5",["insta24","insta01","insta15","insta10","insta08"],[6,5,3,3,3],24],
    ["sortBy=likes&order=asc&limit=3",["insta23","insta21","insta19"],[0,0,0],24],
    ["location=goa&sortBy=likes",["insta01","insta10","insta23","insta16"],[5,3,0,0],4],
    ["location=goa&sortBy=likes&limit=2&page=2",["insta23","insta16"],[0,0],4],
  ]) {
    const body=await get("/posts?"+query);
    assert.deepEqual(keys(body.data),expected,query);
    assert.deepEqual(body.data.map(row=>row._count.likes),counts,query);
    assert.equal(body.meta.total,total);
    for(const item of body.data) summary(item.author);
  }
  expectError(await request("GET","/posts?sortBy=comments"),400,"sortBy must be one of: createdAt, updatedAt, likes");
});

test("user details count posts written and likes given, and hasPosts combines with other filters", async () => {
  for(const [name,counts] of [["riya_travels",{posts:7,likes:4}],["dev_shoots",{posts:2,likes:1}],["aditya_codes",{posts:0,likes:2}]]) {
    const item=await user(name);
    assert.deepEqual((await get(`/users/${item.id}`))._count,counts);
  }
  for(const [query,expected,total] of [
    ["hasPosts=false",["aditya_codes","neha_designs"],2],
    ["hasPosts=true",null,10],
    ["hasPosts=true&isPrivate=true",["dev_shoots","ananya_reads","meera.eats"],3],
    ["hasPosts=false&search=DESIGN&sortBy=username&order=asc&limit=1",["neha_designs"],1],
  ]) {
    const body=await get("/users?"+query);
    if(expected)assert.deepEqual(names(body.data),expected);
    assert.equal(body.meta.total,total);
    assert.equal(body.data.length,total);
  }
  expectError(await request("GET","/users?hasPosts=yes"),400,"hasPosts must be true or false");
});

test("author posts are paginated, have counts without author objects, and distinguish missing users", async () => {
  const riya=await user("riya_travels");
  const aditya=await user("aditya_codes");
  for(const [id,query,expected,expectedMeta] of [
    [riya.id,"?limit=3",["insta23","insta19","insta16"],meta(1,3,7)],
    [riya.id,"?limit=3&page=3",["insta01"],meta(3,3,7)],
    [aditya.id,"",[],meta(1,10,0)],
    [riya.id,"?page=999",[],meta(999,10,7)],
  ]) {
    const body=await get(`/users/${id}/posts${query}`);
    assert.deepEqual(keys(body.data),expected);
    assert.deepEqual(body.meta,expectedMeta);
    for(const row of body.data) { assert.equal(Object.hasOwn(row,"author"),false); assert.equal(typeof row._count.likes,"number"); }
  }
  expectError(await request("GET","/users/2147483647/posts"),404,"User not found");
  expectError(await request("GET",`/users/${riya.id}/posts?page=0`),400,"page and limit must be positive integers");
});

test("people who liked a post are username-sorted public summaries", async () => {
  for(const [key,expected] of [
    ["insta01",["arjun_clicks","isha_dances","meera.eats","neha_designs","vikram.trek"]],
    ["insta24",["aditya_codes","arjun_clicks","riya_travels","rohan_runs","sara_sketches","vikram.trek"]],
    ["insta05",[]],
  ]) {
    const item=await post(key);
    const body=await get(`/posts/${item.id}/likes`);
    assert.deepEqual(names(body),expected);
    body.forEach(summary);
  }
  expectError(await request("GET","/posts/2147483647/likes"),404,"Post not found");
});

test("like/unlike lifecycle, exact error precedence, and composite-key responses", async () => {
  const riya=await user("riya_travels");
  const item=await post("insta05");
  const route=`/posts/${item.id}/likes`;
  const created=await request("POST",route,{userId:riya.id,extra:"ignored"});
  assert.equal(created.status,201);
  assert.deepEqual(Object.keys(created.body).sort(),["createdAt","postId","userId"]);
  assert.equal(created.body.userId,riya.id);
  assert.equal(created.body.postId,item.id);
  expectError(await request("POST",route,{userId:riya.id}),409,"Already liked");
  expectError(await request("POST",route,{}),400,"userId is required");
  expectError(await request("POST","/posts/2147483647/likes",{}),400,"userId is required");
  expectError(await request("POST","/posts/2147483647/likes",{userId:2147483647}),404,"Post not found");
  expectError(await request("POST",route,{userId:2147483647}),404,"User not found");
  assert.deepEqual((await get(`/posts/${item.id}`))._count,{likes:1});
  assert.deepEqual(names(await get(route)),["riya_travels"]);
  const removed=await request("DELETE",`${route}/${riya.id}`);
  assert.equal(removed.status,204);
  assert.equal(removed.text,"");
  expectError(await request("DELETE",`${route}/${riya.id}`),404,"Like not found");
  expectError(await request("DELETE","/posts/2147483647/likes/2147483647"),404,"Like not found");
});

test("concurrent likes create exactly one row and return 409 for every duplicate", async () => {
  const riya=await user("riya_travels");
  const item=await post("insta05");
  const results=await Promise.all(Array.from({length:8},()=>request("POST",`/posts/${item.id}/likes`,{userId:riya.id})));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409,409,409,409,409,409,409]);
  for(const result of results.filter(r=>r.status===409))assert.deepEqual(result.body,{error:"Already liked"});
  assert.equal(await api.prisma.like.count({where:{postId:item.id}}),1);
});

test("deleting Riya cascades through her posts and both sides of likes", async () => {
  const riya=await user("riya_travels");
  const arjun=await user("arjun_clicks");
  const thali=await post("insta10");
  const tiger=await post("insta24");
  assert.deepEqual((await get(`/users/${arjun.id}`))._count,{posts:4,likes:4});
  const removed=await request("DELETE",`/users/${riya.id}`);
  assert.equal(removed.status,204);
  assert.equal(removed.text,"");
  assert.equal((await get("/users?limit=1")).meta.total,11);
  assert.equal((await get("/posts?limit=1")).meta.total,17);
  assert.deepEqual(keys((await get("/posts?location=goa")).data),["insta10"]);
  const ranked=await get("/posts?sortBy=likes&limit=3");
  assert.deepEqual(keys(ranked.data),["insta24","insta15","insta17"]);
  assert.deepEqual(ranked.data.map(row=>row._count.likes),[5,3,2]);
  assert.deepEqual(names(await get(`/posts/${thali.id}/likes`)),["ananya_reads","kabir_sings"]);
  assert.deepEqual(names(await get(`/posts/${tiger.id}/likes`)),["aditya_codes","arjun_clicks","rohan_runs","sara_sketches","vikram.trek"]);
  assert.deepEqual((await get(`/users/${arjun.id}`))._count,{posts:4,likes:2});
  expectError(await request("GET",`/users/${riya.id}/posts`),404,"User not found");
  assert.equal(await api.prisma.like.count(),16);
});

test("bonus liked-posts queries posts directly, paginates, and includes safe relations", async () => {
  for(const [name,query,expected,expectedMeta] of [
    ["riya_travels","",["insta24","insta20","insta10","insta03"],meta(1,10,4)],
    ["arjun_clicks","?limit=2",["insta24","insta14"],meta(1,2,4)],
    ["neha_designs","",["insta22","insta15","insta01"],meta(1,10,3)],
  ]) {
    const item=await user(name);
    const body=await get(`/users/${item.id}/liked-posts${query}`);
    assert.deepEqual(keys(body.data),expected);
    assert.deepEqual(body.meta,expectedMeta);
    for(const row of body.data) { summary(row.author); assert.equal(typeof row._count.likes,"number"); }
  }
  const created=await request("POST","/users",{username:"new_user",email:"new@example.com",fullname:"New User"});
  const empty=await get(`/users/${created.body.id}/liked-posts`);
  assert.deepEqual(empty,{data:[],meta:meta(1,10,0)});
  expectError(await request("GET","/users/2147483647/liked-posts"),404,"User not found");
  expectError(await request("GET",`/users/${created.body.id}/liked-posts?limit=0`),400,"page and limit must be positive integers");
});

test("deleting an individual post cascades its likes without deleting users", async () => {
  const tiger=await post("insta24");
  assert.equal((await request("DELETE",`/posts/${tiger.id}`)).status,204);
  assert.equal(await api.prisma.like.count(),23);
  assert.equal(await api.prisma.user.count(),12);
  const dev=await user("dev_shoots");
  assert.deepEqual((await get(`/users/${dev.id}`))._count,{posts:1,likes:1});
  expectError(await request("GET",`/posts/${tiger.id}/likes`),404,"Post not found");
});

test("failed related seeding rolls all table changes back", async () => {
  const fixtures=require("../prisma/seed-data");
  const riya=await user("riya_travels");
  const author=fixtures.posts[0].author;
  try {
    fixtures.posts[0].author="missing_author";
    await assert.rejects(require("../prisma/seed").seed());
  }finally{fixtures.posts[0].author=author;}
  assert.equal((await user("riya_travels")).id,riya.id);
  assert.equal(await api.prisma.user.count(),12);
  assert.equal(await api.prisma.post.count(),24);
  assert.equal(await api.prisma.like.count(),29);
});
