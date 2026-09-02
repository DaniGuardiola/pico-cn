---
"cn": patch
---

Accept readonly arrays in config extensions. This lets token tuples declared
with `as const` work without a defensive copy.
