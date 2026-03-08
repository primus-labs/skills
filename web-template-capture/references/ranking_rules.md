# Ranking Rules

Use these rules when `find_candidates.mjs` returns multiple plausible sources.

## Prefer

1. Endpoints for the currently logged-in user
2. Endpoints for the current page's primary entity
3. Endpoints that return a single object instead of mixed collections
4. Shallow JSON paths
5. Stable URL semantics such as `viewer`, `account`, `settings`, `profile`, `user`
6. Keys, paths, URLs, or click labels that semantically match the requested field name

## Avoid

1. Recommendation sidebars
2. Search results
3. Ad payloads
4. Timelines unless the target only exists there
5. DOM extraction when a direct JSON source exists
6. Numeric fields whose key conflicts with the target meaning, such as `time`, `timestamp`, `level`, or `status` when the user asked for `volume`

## GraphQL

- Ignore hash-like path segments when ranking stability.
- Prefer the operation name and high-level URL pattern.
- Prefer responses where the target value lives on a top-level entity node instead of repeated timeline entries.
