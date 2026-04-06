## 1. Config

- [x] 1.1 Add `DEFAULT_SINGLETON_PROMOTION_THRESHOLD = 0.7` constant to `amygdala-schema.ts`
- [x] 1.2 Add `INTERNAL_TAGS = ['permanently_skipped', 'llm_rate_limited']` constant to `amygdala-schema.ts`
- [x] 1.3 Add `singletonPromotionThreshold?: number` to `AmygdalaConfig` in `amygdala-process.ts`
- [x] 1.4 Store `singletonPromotionThreshold` on the class (default `DEFAULT_SINGLETON_PROMOTION_THRESHOLD`)

## 2. processEntry Signature

- [x] 2.1 Pass the `relatedMemories` list from `processEntry` into `applyAction` so promotion can use it without a second LTM query

## 3. applyAction — Singleton Promotion

- [x] 3.1 In `applyAction`, compute `isSingleton = relatedMemories.length === 0`
- [x] 3.2 Compute `qualifiesForPromotion = action === 'insert' && importanceScore >= singletonPromotionThreshold && isSingleton`
- [x] 3.3 When `qualifiesForPromotion` is true, pass `tier: 'semantic'` to `ltm.insert()`; otherwise omit `tier` (defaults to `'episodic'`)

## 4. applyAction — Tag Forwarding

- [x] 4.1 Compute `forwardedTags = entry.tags.filter(tag => !INTERNAL_TAGS.includes(tag))`
- [x] 4.2 Include `tags: forwardedTags` inside the `metadata` object on every `ltm.insert()` call

## 5. Tests

- [x] 5.1 Unit test: insert with `importanceScore = 0.85`, no related memories → LTM record has `tier === 'semantic'`
- [x] 5.2 Unit test: insert with `importanceScore = 0.85`, non-empty related memories → LTM record has `tier === 'episodic'`
- [x] 5.3 Unit test: insert with `importanceScore = 0.5`, no related memories → LTM record has `tier === 'episodic'`
- [x] 5.4 Unit test: `action === 'relate'` with `importanceScore = 0.9`, no related memories → LTM record has `tier === 'episodic'`
- [x] 5.5 Unit test: custom `singletonPromotionThreshold: 0.9` — entry with `importanceScore = 0.85` stays episodic
- [x] 5.6 Unit test: `entry.tags = ['behavioral', 'llm_rate_limited']` → `metadata.tags === ['behavioral']`
- [x] 5.7 Unit test: `entry.tags = ['permanently_skipped', 'llm_rate_limited']` → `metadata.tags === []`
- [x] 5.8 Unit test: `entry.tags = []` → `metadata.tags === []`
- [x] 5.9 Unit test: tag forwarding works on `relate` action (new record carries filtered tags)
