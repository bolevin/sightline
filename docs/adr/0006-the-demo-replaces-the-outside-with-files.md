# 6. The demo replaces the outside world with files

## Context

The full application reads Jira and other sources itself and asks agents that run on a model. A public demo can have none of that: no real data, no credentials, no model.

## Decision

The demo keeps the whole path from data to page and replaces only the entry points with files in the data folder. Jira is a folder in Jira's own format, written by a generator from an invented plan. Pull requests, incident reports and the service list are prepared views. The agent's briefing and a handful of answers are recordings. The briefing is checked on every build exactly as a live reply would be, and one of its lines is wrong on purpose so that the check has something to drop.

## What it costs

The demo cannot show the live collectors, the agent runtime, or how the application behaves when a source is slow or down. Its data is too tidy: real boards are messier than a generator.
