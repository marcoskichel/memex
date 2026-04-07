## 1. Spec Update

- [x] 1.1 Add idempotency scenario to `entity-extraction-process` spec under `buildEntityInsertPlan` requirements: "Duplicate edge across two records produces one graph edge"
- [x] 1.2 Verify existing integration test 8.2 (two records, same entity) still passes — it implicitly validates edge idempotency via node count
