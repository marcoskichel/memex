## ADDED Requirements

### Requirement: Name origin documented at repo root

The repository SHALL contain a `NAME.md` file at its root explaining the etymology and rationale for the name "Memex".

The file SHALL include:

- The origin: Vannevar Bush's 1945 essay _As We May Think_
- What the Memex was: a proposed device for storing and retrieving information associatively, extending human memory
- Why it fits this project: this library is precisely that — memory infrastructure for AI agents designed to mirror how human memory works
- The alternative names considered and why they were rejected

#### Scenario: Contributor reads NAME.md

- **WHEN** a new contributor opens the repository on GitHub
- **THEN** they can read `NAME.md` at the repo root and understand why the project is called Memex without needing to find external references

#### Scenario: NAME.md links to source essay

- **WHEN** `NAME.md` is rendered
- **THEN** it includes a reference to Bush's original 1945 essay _As We May Think_
