## ADDED Requirements

### Requirement: Query result set may exceed requested limit when companions are injected

`LtmEngine.query()` SHALL return at most `limit` records from the main ranking pipeline.
Companion records injected due to supersession MAY cause the total result count to exceed
`limit`. Companions are always appended after main results.

#### Scenario: Result count equals limit when no superseded records

- **WHEN** a query with `limit: 5` returns 5 results and none are superseded
- **THEN** exactly 5 results are returned

#### Scenario: Result count may exceed limit when companions injected

- **WHEN** a query with `limit: 5` returns 5 results and 2 are superseded with companions not in the set
- **THEN** up to 7 results may be returned (5 main + 2 companions)
