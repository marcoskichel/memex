## ADDED Requirements

### Requirement: Three-pane layout

The TUI SHALL render three panes: events feed (upper-left), stats panel (upper-right), and query REPL (bottom). The events and stats panes share the upper half; the query REPL occupies the lower third.

#### Scenario: Terminal render

- **WHEN** the TUI starts and connects to cortex
- **THEN** all three panes are visible and sized proportionally to terminal dimensions

### Requirement: Keyboard navigation between panes

`tab` SHALL cycle focus between panes. The focused pane SHALL have a highlighted border. Keyboard input is routed to the focused pane.

#### Scenario: Tab cycles focus

- **WHEN** user presses `tab`
- **THEN** focus moves from events → stats → query → events

### Requirement: Status bar

A single-line status bar at the top SHALL display session ID, connection status (● live / ○ disconnected), LTM record count, and STM pending count.

#### Scenario: Connected state

- **WHEN** connected to cortex
- **THEN** status bar shows `● live` in green with current stats

#### Scenario: Disconnected state

- **WHEN** connection is lost
- **THEN** status bar shows `○ reconnecting...` in yellow

### Requirement: `q` quits from any pane

Pressing `q` from any unfocused-on-input context SHALL exit the TUI cleanly.

#### Scenario: Quit key

- **WHEN** user presses `q` while not typing in the query REPL
- **THEN** the TUI exits and the terminal is restored
