---
name: "OPSX: Propose"
description: Propose a new change - create it and generate all artifacts in one step
category: Workflow
tags: [workflow, artifacts, experimental]
---

Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

When ready to implement, run /opsx:apply

---

**Input**: The argument after `/opsx:propose` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Determine if this is a single-scope or cross-scope change**

   Check for a workspace manifest:
   ```bash
   cat openspec/workspace.yaml 2>/dev/null
   ```

   If workspace.yaml exists:
   - Based on the description, ask: "Does this change touch more than one scope?"
   - If **single scope**: ask which scope (show list from workspace.yaml). Store as `<workspace>`. Continue to step 3.
   - If **cross-scope (umbrella)**: jump to **Umbrella Flow** section below.

   If no workspace.yaml (single-project):
   - `<workspace>` is the current directory. Skip to step 3.

   All `openspec` commands must be run as:
   ```bash
   (cd <workspace> && openspec ...)
   ```

3. **Create the change directory**
   ```bash
   (cd <workspace> && openspec new change "<name>")
   ```
   This creates a scaffolded change at `<workspace>/openspec/changes/<name>/` with `.openspec.yaml`.

4. **Get the artifact build order**
   ```bash
   (cd <workspace> && openspec status --change "<name>" --json)
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies

5. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        (cd <workspace> && openspec instructions <artifact-id> --change "<name>" --json)
        ```
      - The instructions JSON includes:
        - `context`: Project background (constraints for you - do NOT include in output)
        - `rules`: Artifact-specific rules (constraints for you - do NOT include in output)
        - `template`: The structure to use for your output file
        - `instruction`: Schema-specific guidance for this artifact type
        - `outputPath`: Where to write the artifact
        - `dependencies`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - Create the artifact file using `template` as the structure
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all `applyRequires` artifacts are complete**
      - After creating each artifact, re-run `(cd <workspace> && openspec status --change "<name>" --json)`
      - Check if every artifact ID in `applyRequires` has `status: "done"` in the artifacts array
      - Stop when all `applyRequires` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

6. **Show final status**
   ```bash
   (cd <workspace> && openspec status --change "<name>")
   ```

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions
- What's ready: "All artifacts created! Ready for implementation."
- Prompt: "Run `/opsx:apply` to start implementing."

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

## Umbrella Flow *(cross-scope changes only)*

1. **Confirm which scopes are involved** using AskUserQuestion tool.

2. **Create the umbrella directory**
   ```bash
   mkdir -p openspec/changes/<name>
   ```

3. **Write `openspec/changes/<name>/links.yaml`**
   ```yaml
   scopes:
     - name: <scope-a>
       path: <scope-a.path>
     - name: <scope-b>
       path: <scope-b.path>
   ```

4. **Write `openspec/changes/<name>/proposal.md`** — cross-cutting description covering what, why, which scopes, any shared contracts.

5. **Create per-scope changes**: for each scope, run `(cd <scope.path> && openspec new change "<name>")` and generate all artifacts following steps 3-6 of the standard flow. Complete one scope before the next.

6. **Show completion summary** with umbrella location and per-scope change locations.

**Guardrails**
- For umbrella changes, always create umbrella directory and links.yaml before per-scope changes
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
