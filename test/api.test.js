const { test } = require("node:test");
const assert = require("node:assert/strict");
const api = require("./helpers");
api.setup();
function scalar(record) {
  const { author, _count, ...fields } = record;
  return fields;
}
async function request(method, route, body, raw = false) {
  if (method === "POST" && route === "/posts" && typeof body?.imageUrl === "string" && body.imageUrl.trim() && body.authorId === undefined) {
    const author = await api.prisma.user.upsert({
      where: { username: "regression_author" }, update: {},
      create: { username: "regression_author", email: "regression@example.com", fullname: "Regression Author" },
    });
    body = { ...body, authorId: author.id };
  }
  return api.request(method, route, body, raw);
}

const userData = { username: "riya_travels", email: "riya@example.com", fullname: "Riya Sharma" };
const postData = { imageUrl: "https://example.com/photo.jpg" };

function expectError(result, status, error) {
  assert.equal(result.status, status);
  assert.deepEqual(result.body, { error });
}

function expectTimestamps(record) {
  assert.ok(Number.isInteger(record.id));
  assert.ok(!Number.isNaN(Date.parse(record.createdAt)));
  assert.ok(!Number.isNaN(Date.parse(record.updatedAt)));
}

test("health and initially empty collections", async () => {
  assert.deepEqual(await request("GET", "/health"), { status: 200, body: { status: "OK" }, text: '{"status":"OK"}' });
  for (const route of ["/users", "/posts"]) {
    const result = await request("GET", route);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data, []);
  }
});

test("user CRUD, defaults, field restrictions, partial updates, and empty deletion", async () => {
  const created = await request("POST", "/users", {
    ...userData, id: 999, isPrivate: true, createdAt: "2000-01-01", updatedAt: "2000-01-01", extra: "ignored",
  });
  assert.equal(created.status, 201);
  expectTimestamps(created.body);
  assert.notEqual(created.body.id, 999);
  assert.equal(created.body.bio, null);
  assert.equal(created.body.isPrivate, false);
  assert.equal(Object.hasOwn(created.body, "extra"), false);
  const id = created.body.id;
  assert.deepEqual(scalar((await request("GET", `/users/${id}`)).body), created.body);
  assert.deepEqual((await request("GET", "/users")).body.data, [created.body]);

  const updated = await request("PATCH", `/users/${id}`, {
    fullname: "Riya S", bio: "Traveler", isPrivate: true,
    username: "changed", email: "changed@example.com", id: 999, createdAt: "2000-01-01",
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.fullname, "Riya S");
  assert.equal(updated.body.bio, "Traveler");
  assert.equal(updated.body.isPrivate, true);
  assert.equal(updated.body.username, userData.username);
  assert.equal(updated.body.email, userData.email);
  assert.equal(updated.body.id, id);
  assert.equal(updated.body.createdAt, created.body.createdAt);
  assert.ok(Date.parse(updated.body.updatedAt) >= Date.parse(created.body.updatedAt));

  const partial = await request("PATCH", `/users/${id}`, { bio: null, isPrivate: false });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.bio, null);
  assert.equal(partial.body.isPrivate, false);
  assert.equal(partial.body.fullname, "Riya S");
  const ignored = await request("PATCH", `/users/${id}`, { username: null, email: 123 });
  assert.equal(ignored.status, 200);
  assert.equal(ignored.body.username, userData.username);
  assert.equal((await request("PATCH", `/users/${id}`, {})).status, 200);

  const deleted = await request("DELETE", `/users/${id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, "");
  expectError(await request("GET", `/users/${id}`), 404, "User not found");
  assert.deepEqual((await request("GET", "/users")).body.data, []);
});

test("required user fields and database-backed uniqueness constraints", async () => {
  for (const body of [{}, { username: "onlyname" }, { ...userData, fullname: " " }, { ...userData, email: 123 }]) {
    expectError(await request("POST", "/users", body), 400, "username, email and fullname are required");
  }
  expectError(await request("POST", "/users"), 400, "username, email and fullname are required");
  const created = await request("POST", "/users", { ...userData, bio: "Hello" });
  assert.equal(created.status, 201);
  assert.equal(created.body.bio, "Hello");
  expectError(await request("POST", "/users", { ...userData, email: "other@example.com" }), 409, "username or email already taken");
  expectError(await request("POST", "/users", { ...userData, username: "another" }), 409, "username or email already taken");
  assert.equal((await request("GET", "/users")).body.data.length, 1);
});

test("post CRUD, defaults, immutable image URL, partial updates, and deletion", async () => {
  const created = await request("POST", "/posts", { ...postData, id: 999, createdAt: "2000-01-01", extra: true });
  assert.equal(created.status, 201);
  expectTimestamps(created.body);
  assert.notEqual(created.body.id, 999);
  assert.equal(created.body.caption, null);
  assert.equal(created.body.location, null);
  assert.equal(Object.hasOwn(created.body, "extra"), false);
  const id = created.body.id;
  assert.deepEqual(scalar((await request("GET", `/posts/${id}`)).body), created.body);
  assert.deepEqual((await request("GET", "/posts")).body.data.map(scalar), [created.body]);

  const updated = await request("PATCH", `/posts/${id}`, {
    caption: "Sunset", location: "Goa", imageUrl: "https://example.com/changed.jpg", id: 999,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.caption, "Sunset");
  assert.equal(updated.body.location, "Goa");
  assert.equal(updated.body.imageUrl, postData.imageUrl);
  assert.equal(updated.body.id, id);
  assert.equal(updated.body.createdAt, created.body.createdAt);
  const partial = await request("PATCH", `/posts/${id}`, { caption: null });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.caption, null);
  assert.equal(partial.body.location, "Goa");
  const ignored = await request("PATCH", `/posts/${id}`, { imageUrl: null });
  assert.equal(ignored.status, 200);
  assert.equal(ignored.body.imageUrl, postData.imageUrl);
  assert.equal((await request("PATCH", `/posts/${id}`, {})).status, 200);

  const deleted = await request("DELETE", `/posts/${id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, "");
  expectError(await request("GET", `/posts/${id}`), 404, "Post not found");
  assert.deepEqual((await request("GET", "/posts")).body.data, []);

  const optional = await request("POST", "/posts", { ...postData, caption: "Hello", location: "Mumbai" });
  assert.equal(optional.status, 201);
  assert.equal(optional.body.caption, "Hello");
  assert.equal(optional.body.location, "Mumbai");
});

test("missing posts and absent records on GET, PATCH, and DELETE", async () => {
  for (const body of [{}, { caption: "No image" }, { imageUrl: " " }, { imageUrl: 123 }]) {
    expectError(await request("POST", "/posts", body), 400, "imageUrl and authorId are required");
  }
  expectError(await request("POST", "/posts"), 400, "imageUrl and authorId are required");
  for (const [route, name] of [["users", "User"], ["posts", "Post"]]) {
    for (const method of ["GET", "PATCH", "DELETE"]) {
      expectError(await request(method, `/${route}/2147483647`, method === "PATCH" ? {} : undefined), 404, `${name} not found`);
    }
  }
});

test("invalid IDs and field types cannot corrupt records", async () => {
  for (const route of ["users", "posts"]) {
    for (const id of ["abc", "0", "-1", "1.5", "1abc", "2147483648"]) {
      for (const method of ["GET", "PATCH", "DELETE"]) {
        expectError(await request(method, `/${route}/${id}`, method === "PATCH" ? {} : undefined), 400, "id must be a positive 32-bit integer");
      }
    }
  }
  const user = (await request("POST", "/users", userData)).body;
  for (const body of [{ fullname: null }, { bio: 123 }, { isPrivate: "false" }]) {
    assert.equal((await request("PATCH", `/users/${user.id}`, body)).status, 400);
  }
  assert.deepEqual(scalar((await request("GET", `/users/${user.id}`)).body), user);
  const post = (await request("POST", "/posts", postData)).body;
  for (const body of [{ caption: 123 }, { location: false }]) {
    assert.equal((await request("PATCH", `/posts/${post.id}`, body)).status, 400);
  }
  assert.deepEqual(scalar((await request("GET", `/posts/${post.id}`)).body), post);
  assert.equal((await request("POST", "/users", { ...userData, bio: 123 })).status, 400);
  assert.equal((await request("POST", "/posts", { ...postData, caption: false })).status, 400);
});

test("malformed JSON and unknown routes return JSON errors", async () => {
  expectError(await request("POST", "/users", '{"username":', true), 400, "Invalid JSON body");
  expectError(await request("GET", "/missing"), 404, "Route not found");
});
