const { test } = require("node:test");
const assert = require("node:assert/strict");
const api = require("./helpers");
api.setup({ seeded: true });
const { request, expectError } = api;
const usernames = body => body.data.map(user => user.username);
const postKeys = body => body.data.map(post => post.imageUrl.split("/")[4]);
async function check(route, expected, meta, select) {
  const response = await request("GET", route);
  assert.equal(response.status, 200, route);
  assert.deepEqual(select(response.body), expected, route);
  assert.deepEqual(response.body.meta, meta, route);
  return response.body;
}
const meta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const userOrder = ["dev_shoots", "isha_dances", "aditya_codes", "neha_designs", "vikram.trek", "sara_sketches", "rohan_runs", "ananya_reads", "kabir_sings", "meera.eats", "arjun_clicks", "riya_travels"];
const postOrder = Array.from({ length: 24 }, (_, i) => `insta${String(24-i).padStart(2, "0")}`);

test("all Phase 2 user pagination examples", async () => {
  for (const [query, names, expected] of [
    ["", userOrder.slice(0,10), meta(1,10,12)],
    ["?page=2", userOrder.slice(10), meta(2,10,12)],
    ["?page=3&limit=5", userOrder.slice(10), meta(3,5,12)],
    ["?limit=100", userOrder, meta(1,50,12)],
    ["?page=5", [], meta(5,10,12)],
  ]) await check("/users"+query, names, expected, usernames);
});

test("all Phase 2 user sorting examples", async () => {
  const data = await check("/users?sortBy=username&order=asc", [...userOrder].sort().slice(0,10), meta(1,10,12), usernames);
  assert.equal(data.data.length,10);
  await check("/users?sortBy=fullname&order=desc&limit=3", ["vikram.trek", "sara_sketches", "rohan_runs"], meta(1,3,12), usernames);
  await check("/users?order=asc&limit=2", ["riya_travels", "arjun_clicks"], meta(1,2,12), usernames);
});

test("all Phase 2 user filtering examples", async () => {
  for (const [query, names] of [
    ["isPrivate=true", ["dev_shoots", "neha_designs", "ananya_reads", "meera.eats"]],
    ["isPrivate=false", ["isha_dances", "aditya_codes", "vikram.trek", "sara_sketches", "rohan_runs", "kabir_sings", "arjun_clicks", "riya_travels"]],
    ["search=sh", ["dev_shoots", "isha_dances", "riya_travels"]],
    ["search=SH&isPrivate=false&sortBy=fullname&order=asc&limit=2", ["isha_dances", "riya_travels"]],
    ["search=zzz", []],
  ]) await check("/users?"+query, names, meta(1,query.includes("limit=2")?2:10,names.length), usernames);
});

test("all Phase 2 post pagination and sorting examples", async () => {
  for (const [query, keys, expected] of [
    ["", postOrder.slice(0,10), meta(1,10,24)],
    ["?page=3", postOrder.slice(20), meta(3,10,24)],
    ["?page=4", [], meta(4,10,24)],
    ["?order=asc&limit=3", ["insta01", "insta02", "insta03"], meta(1,3,24)],
    ["?limit=100", postOrder, meta(1,50,24)],
  ]) await check("/posts"+query, keys, expected, postKeys);
  const result = await request("GET", "/posts?sortBy=updatedAt&order=asc");
  assert.equal(result.status,200);
  const times = result.body.data.map(row => Date.parse(row.updatedAt));
  assert.deepEqual(times,[...times].sort((a,b)=>a-b));
});

test("all Phase 2 post filtering examples", async () => {
  for (const [query, keys, expected] of [
    ["location=GOA", ["insta23", "insta16", "insta10", "insta01"], meta(1,10,4)],
    ["search=sunset", ["insta20", "insta08", "insta01"], meta(1,10,3)],
    ["from=2026-03-01&to=2026-04-01", postOrder.slice(8,16), meta(1,10,8)],
    ["from=2026-04-01", postOrder.slice(0,8), meta(1,10,8)],
    ["location=pune&search=CHAI", ["insta15"], meta(1,10,1)],
    ["location=mumbai&limit=2&page=2", ["insta06", "insta02"], meta(2,2,4)],
    ["from=2026-03-07T13:40:00.000Z&to=2026-03-11T05:20:00.000Z", ["insta10"], meta(1,10,1)],
    ["location=missing", [], meta(1,10,0)],
  ]) await check("/posts?"+query, keys, expected, postKeys);
});

test("exact query validation errors, including empty and repeated values", async () => {
  for (const route of ["/users","/posts"]) {
    for (const query of ["page=0","page=-1","page=1.5","page=abc","page=","limit=0","limit=abc","limit=","page=1&page=2","limit=1e2"])
      expectError(await request("GET",route+"?"+query),400,"page and limit must be positive integers");
    expectError(await request("GET",route+"?order=sideways"),400,"order must be asc or desc");
    expectError(await request("GET",route+"?order="),400,"order must be asc or desc");
  }
  expectError(await request("GET","/users?sortBy=email"),400,"sortBy must be one of: createdAt, username, fullname");
  expectError(await request("GET","/users?isPrivate=maybe"),400,"isPrivate must be true or false");
  const allowed = require("../prisma/seed-data").likes ? "createdAt, updatedAt, likes" : "createdAt, updatedAt";
  expectError(await request("GET","/posts?sortBy=caption"),400,"sortBy must be one of: "+allowed);
  for (const query of ["from=yesterday","to=invalid","from=","from=2026-02-30","from=2026-13-01"])
    expectError(await request("GET","/posts?"+query),400,"from and to must be valid dates");
});

test("all three seed commands are repeatable and use fresh generated IDs", async () => {
  const first = await api.prisma.user.findUnique({ where: { username:"riya_travels" } });
  const expected = "🌱 Seeded 12 users, 24 posts and 29 likes";
  for (const [executable,args] of [["npx",["--no-install","prisma","db","seed"]],["npm",["run","seed"]],["npm",["run","seed"]]]) {
    // PGlite exposes one physical session; release it before the seed subprocess.
    await api.prisma.$disconnect();
    assert.ok((await api.command(executable,args)).includes(expected));
    assert.equal(await api.prisma.user.count(),12);
    assert.equal(await api.prisma.post.count(),24);
    if(api.prisma.like) assert.equal(await api.prisma.like.count(),29);
  }
  const last = await api.prisma.user.findUnique({ where: { username:"riya_travels" } });
  assert.ok(last.id > first.id);
});
