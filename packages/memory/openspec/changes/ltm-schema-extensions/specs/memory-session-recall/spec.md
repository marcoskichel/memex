## ADDED Requirements

### Requirement: Memory exposes recallSession

The `Memory` interface SHALL expose `recallSession(sessionId: string, query: string, options?: Omit<LtmQueryOptions, 'sessionId'>): Promise<LtmQueryResult[]>`. It SHALL delegate to `ltm.query()` with `sessionId` fixed to the supplied value.

#### Scenario: recallSession returns only records from the specified session

- **WHEN** `memory.recallSession('session-42', 'preferences')` is called
- **THEN** only records with `sessionId === 'session-42'` are returned

#### Scenario: recallSession accepts additional query options

- **WHEN** `memory.recallSession('session-42', 'preferences', { tier: 'episodic' })` is called
- **THEN** only episodic records from session-42 matching the query are returned

#### Scenario: recallSession with unknown sessionId returns empty array

- **WHEN** `memory.recallSession('nonexistent-session', 'anything')` is called
- **THEN** an empty array is returned with no error
