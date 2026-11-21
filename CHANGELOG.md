# Changelog

## 2.0.0 (2026-11-21)

- The live demo is now the design of version 2: 52 pages on an invented team. A home screen with what the team
  promised, what puts it at risk, what waits for a decision and what changed. Briefings for seven events of the
  team. Seven domains: Delivery, Product, Engineering, Quality, Operations, Release and Knowledge. Compare two days,
  an event log, AI Command and eleven palettes.
- Its numbers are invented and prepared by hand, and the page says so. The first version, where code computes
  every number, stays at `/demo/`, and `python run.py` still starts it.
- The design demo fits a phone: the side rail is a menu, and panels stand below each other.

## 1.2.1 (2026-11-17)

- Quality: a bug resolved or written at the moment one sprint ends and the next starts counts in the new sprint.
  Open, created and resolved now add up for every sprint.
- Quality: the usual range of new bugs comes from the six full sprints before the last one, and needs three of
  them at least. A last sprint above the range is marked for a look.

## 1.2.0 (2026-11-17)

- Code: builds and deploys. The records of a build server over half a year, invented, with their own generator.
  The four DORA measures for the last 12 weeks next to the 12 before: deploys, lead time for changes, failed
  deploys and time to restore. Where the lead time of a change goes, every deploy on a time line with its repair,
  how often main was red and why, releases against hotfixes, and every deploy with the incident reports that
  followed it.
- Ask: a recorded answer to "How fast do we ship?".
- System: the build server on the map, and the delivery measures among what code computes.

## 1.1.0 (2026-11-15)

- The page fits a phone. The header is two short rows, with the tabs as a strip that scrolls sideways. The charts
  are drawn for a narrow screen. Long tables fold into blocks or scroll inside their panel. A tap on a mark of a
  chart shows what a resting pointer would.
- System: the architecture is a map of who talks to whom. You and your browser, the app, the agents with the
  model behind them and the systems of the team are blocks with their parts; every link says what goes over it,
  a teal frame marks what sends data off the computer, and the numbers are those of the page. A narrow screen
  shows the same parts as layers below each other. Below stand the steps of one morning and the decisions
  behind the design, with links to their records. The sources that were only planned are gone: the map shows
  what exists.
- Ask: a microphone. The browser turns speech into text, and a question that was spoken is matched to the
  recorded one without its question mark. The page says, while it listens, that the audio leaves the computer.
- README: the link to the live demo is a button.

## 1.0.0 (2026-11-15)

The first public demo.

- Today: three questions about the sprint, each line with the facts behind it.
- Promises: the forecast from the team's own history, options when the sprint does not fit, and how often past
  forecasts held.
- Risks: signals from the data, a pre-mortem from the team's own missed sprints, and a risk register.
- Operations: what reached the team, the services it runs, incident reports and what comes back.
- Evidence tabs: Sprint, Flow, Code, Quality, Hygiene.
- Quality: the bugs of four increments. Created and resolved, where bugs are found, time to fix against a target
  per severity, bugs still open after N days, bug debt by age, causes, services, releases, and what moves
  together with bugs, each link with the range it could have. An agent words the findings and code checks them.
- Inbox: drafts of sprint status, a note to the Product Owner, points for the Daily, a sprint review and questions
  for the retrospective.
- A card for every issue: rest the pointer on an issue key and see its title, type, priority and status. Titles go
  to the card and nowhere else.
- Ask window with recorded answers, and four read-only tools for an agent over the Model Context Protocol.
- Invented data for one team, with its generator, and a hosted copy of the page for GitHub Pages.
