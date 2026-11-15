# 3. Read-only and local

## Context

The application is pointed at systems that hold a company's work. An agent that can post, transition or mail is a risk nobody wants to review, and a tool that needs a server needs an owner for it.

## Decision

The application only reads its sources. It serves one page on 127.0.0.1 and checks that requests come from that page. It accepts four kinds of request besides page loads, and only two of them write: the user's risk register and the record of what the user sent, both plain files next to the application. Agents get four read-only tools and nothing else. Texts for other people are drafts that the user copies and sends.

## What it costs

No automation of the last step: a status has to be pasted by a person. One user per installation, no shared view.
