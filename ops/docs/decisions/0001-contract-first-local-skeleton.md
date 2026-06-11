# 0001: Contract-First Local Skeleton

Status: Accepted for slice 1.

## Context

CommandKit needs a safe initial repo shape before any adapter, runtime, or
execution integration exists.

## Decision

Use Markdown docs, JSON contracts, JSON fixtures, and dependency-free Node.js
validation. Do not add application packages, provider SDKs, or external
integrations in slice 1.

## Consequences

- The repo can document boundaries before behavior exists.
- SourceGrid and partner command packs can be added later against stable
  contracts.
- No real actions can be triggered from this skeleton.
- Future execution work requires a new decision and approval tests.
