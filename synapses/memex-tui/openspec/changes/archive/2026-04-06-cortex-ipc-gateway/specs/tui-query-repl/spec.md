## ADDED Requirements

### Requirement: Natural-language query input

The query REPL SHALL accept a natural-language string, send a `recall` request to cortex on `enter`, and display ranked results.

#### Scenario: Successful query

- **WHEN** user types "authentication flow" and presses enter
- **THEN** the REPL sends recall and displays up to 10 results with score, type, date, and tags

#### Scenario: Empty query

- **WHEN** user presses enter with an empty input
- **THEN** no request is sent and the REPL stays in idle state

### Requirement: Result navigation

Arrow keys SHALL navigate the result list. The selected result SHALL be highlighted.

#### Scenario: Navigate results

- **WHEN** user presses down arrow on the result list
- **THEN** focus moves to the next result

### Requirement: Full record expansion

Pressing `enter` on a selected result SHALL send a `recallFull` request (via `recall` with the record ID) and display the full record data and episode summary in an overlay or expanded section.

#### Scenario: Expand result

- **WHEN** user presses enter on a result
- **THEN** the full record content and episode summary (if present) are displayed

### Requirement: Clear and reset

Pressing `esc` SHALL dismiss the expanded view (if open) or clear the result list and return to input (if not).

#### Scenario: Dismiss expanded view

- **WHEN** user presses esc while a full record is shown
- **THEN** the result list is restored

#### Scenario: Clear results

- **WHEN** user presses esc on the result list
- **THEN** results are cleared and input is focused and empty
