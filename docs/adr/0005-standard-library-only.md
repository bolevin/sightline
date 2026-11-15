# 5. Standard library only

## Context

The application is meant to run on a company laptop where installing packages needs approval, and to stay runnable for years without maintenance of dependencies.

## Decision

The server, the forecast, the tools endpoint and the tests use the Python standard library only. The page is plain HTML, CSS and JavaScript, with charts drawn as SVG by a few functions. There is no build step.

## What it costs

More code for things a library would give: the HTTP handling, the charts, the simulation. No type checker or linter is enforced in this demo.
