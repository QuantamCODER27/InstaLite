# Viva notes

1. **Why did adding authorId fail on the seeded database?** Existing posts have no authorId. A required foreign key cannot be filled with NULL, and Prisma cannot guess the author. The migration check explicitly reported 24 existing rows. An empty development database can apply it; preserving real data requires a deliberate backfill.

2. **Why does Like have no id?** `(userId, postId)` already identifies the relationship. Its composite primary key prevents duplicate likes at the database level. It also provides an index for queries beginning with userId, so only postId needs an additional index.

3. **Why an explicit join table?** The relationship stores its own createdAt timestamp. An implicit relation does not expose a model for that extra data.

4. **include vs select?** include keeps a model's scalar fields and adds relations. select returns only named fields. Posts include their author using a nested select for id, username, and fullname, so author emails are never exposed.

5. **What is N+1?** A page of ten posts followed by one author lookup and one like count per post costs 21 queries before counting the page total. include and _count express the related read in one Prisma operation and avoid per-post loops. Prisma may execute a bounded number of SQL queries depending on relation loading strategy; one Prisma call does not always mean one SQL round trip. Pages and totals share one transaction.

6. **Why catch P2002?** Two requests can both observe that a like does not yet exist, then both insert. Checking first cannot prevent that race. The composite key makes one insert succeed and rejects the other; catching P2002 produces 409 Already liked. The implementation checks post then user existence for the required 404 precedence, but never pre-checks like uniqueness.

7. **Why did Arjun's likes change when Riya left?** Deleting Riya deletes her seven authored posts. Their likes are then deleted, including Arjun's likes on insta01 and insta08. His given-like count falls from four to two. Riya's four given likes also disappear through the User-to-Like cascade.

8. **Cascade or Restrict?** Cascade fits this lab's rule that removing an account removes its posts and likes. A real app may prefer soft deletion and retention rules. Financial records generally require restrictive deletion and audit-preserving updates rather than cascading transaction deletion.

9. **Why children-first seed deletion with Cascade enabled?** It documents the dependency order and remains valid if a relationship later changes to Restrict. The seed transaction also prevents partial replacement when an insert fails.

10. **How is missing author detection implemented?** A small user lookup returns a clear User not found before inserting. Catching the foreign-key error alone would save one lookup; the code also catches it to handle an author deleted between validation and insertion.
