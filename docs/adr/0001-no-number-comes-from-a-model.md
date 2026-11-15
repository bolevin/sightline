# 1. No number comes from a model

## Context

A Scrum Master wants a short text every morning that says what matters in the sprint. A language model writes such a text well. It also invents numbers, drops a digit, or states a share it worked out itself, and a reader cannot tell which number to trust.

## Decision

The model never sees raw data and never does arithmetic. Code computes facts: small records with an id, a value and the issue keys behind it. The model gets the facts and returns lines, each citing the facts it rests on. Code then checks every line: each digit must be the value of a cited fact, each issue key must stand behind one, and a share in words is refused. A line that fails is dropped and the reason is shown. When nothing is left, fixed rules lay out the same facts.

## What it costs

The model cannot say anything the facts do not hold, so a useful observation that needs a new number waits until code computes it as a fact. The check proves that numbers are real, not that the sentence around them is right.
