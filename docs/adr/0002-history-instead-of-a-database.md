# 2. History instead of a database

## Context

To say whether a sprint keeps its promise, the application has to know what the sprint looked like when it started, and what the team did in earlier sprints at the same point. A tool that samples the board every day only knows the days on which it ran.

## Decision

Nothing is sampled. Jira keeps the current value of every field and a changelog of every change. The value of a field at any moment is the current value with the later changes undone. From that, the scope of any sprint and the forecast of any past morning can be computed today. The application stores only what cannot be computed again: the user's own notes.

## What it costs

Every page build reads the whole history, which is fine for one team and would need a cache for fifty. Fields that leave no trace in the changelog, such as a value chosen when an issue was created, are invisible to the look back.
