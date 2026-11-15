# 4. No people, and a title is for the eyes only

## Context

Names next to numbers turn a team tool into a ranking of people. Issue titles and comments can hold customer data,
and whatever is given to a language model has left the building. Both make it hard to get a tool approved and
easy to lose the team's trust. But a page of bare issue keys is hard to read: nobody remembers what KES-1391 was.

## Decision

The application has no field for a person. Every count is a count of work items at team level.

A title is shown and nothing else. When the pointer rests on an issue key, a card shows the title, the type, the
priority and the status of the issue. The title reaches the page on a path of its own (`cards`), next to the facts
and never inside them: the fact layer has no field for it, and the code that words, checks or drafts a text and
the tools for agents do not import that path. So no fact, no draft and no agent can carry a title. Descriptions
and comments are not read at all. The full version reads a title from Jira at the moment a card opens and does
not keep it.

## What it costs

A draft or an answer of an agent names issues by key only, so the reader needs the card to know what they are.
A question like "who is overloaded" cannot be asked at all. That second cost is intended.
