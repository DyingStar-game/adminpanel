# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** Project-wide

## Context

The admin panel is an open-source community project. Contributors come and go, and the
reasons behind design choices (BFF boundaries, persistence handling, UI patterns) get lost
in chat history. We are about to rework the "Manage persistence" area and want to define
the need before writing code.

## Decision

We will record significant decisions as ADRs in `docs/adr/`, following the conventions in
[`README.md`](./README.md). Analysis comes first: an ADR is drafted as `Proposed`, discussed,
then `Accepted` before implementation starts.

## Consequences

- Each feature branch may add one or more ADRs alongside its code.
- Reviewers can check an implementation against its accepted ADR.
- Small cost: writing a short document for each non-trivial decision.
