# Jira/Xray Traceability Rules

## Requirement coverage
- Every in-scope Story must have at least one relevant Test or an explicit documented coverage gap.
- Tests must validate acceptance criteria or documented expected behavior.
- Record the source requirement for each Test.

## Risk coverage
- Every high-priority Risk must have at least one mitigation Test or a documented exception.
- Risk priority must be based on impact and likelihood, with rationale.
- Do not claim that a Risk is fully mitigated merely because a Test exists.

## Xray organization
- Test Sets group Tests for a defined purpose.
- Test Plans represent a planned scope of testing.
- Test Executions represent actual execution runs and results.
- Do not create redundant Test Sets or Test Plans for every Story.

## Defect relationships
- Link a Bug to a failed Test when evidence supports the relationship.
- Link a Bug to the affected requirement when the impact is established.
- Distinguish product defects from test-script defects, environment failures, and third-party outages.

## Relationship verification
- Verify every required link after creation.
- Check the actual relationship direction and type.
- Treat unverified links as incomplete.
- Never count a planned link as an existing link.

## Repeatability
- Reconcile planned entities against persistent mappings before creation.
- Never create a duplicate merely because a previous run was interrupted.
- Record all unresolved mapping conflicts for investigation.