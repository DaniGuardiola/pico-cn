---
"cn": patch
---

Faster many-argument calls: predictions are now probed in place, so a warm 4+ argument call allocates nothing (~44ns → ~32ns).
