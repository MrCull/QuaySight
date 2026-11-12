# Quay Sight documentation

Quay Sight is a browser-only app that inspects photos of freight containers. It reads the container ID, size and type, weights, seal and placards, and it marks damage on a flat schematic. Every value comes with a certainty word. It is a demonstration, not a certified survey.

| Read this | When you want to know |
| --- | --- |
| [Overview](overview.md) | What the product is, what it produces, and what it deliberately doesn't do |
| [User guide](user-guide.md) | How to run an inspection, screen by screen, with screenshots |
| [Reading the results](results-guide.md) | What each part of the result means, and the certainty words |
| [How it works](how-it-works.md) | What happens between choosing photos and seeing a result |
| [Architecture](architecture.md) | Code layout, providers, spend caps, tests and commands |

Other documents in this repo:

- `spec/original-spec-idea.md`: the product specification. It is the source of truth for behaviour.
- `design-system/README.md`: the design system every screen follows.
- `docs/adr/`: architecture decisions.
- `docs/research/`: checked facts about the live provider APIs. Each note carries its check date.

## Screenshots

The images in `docs/images/` come from the screenshot harness (`npm run screenshots`, which writes to the git-ignored `screenshots/` folder). They show the bundled recorded samples running in demo mode. To refresh one, run the harness and copy the new file over the old one. Keep images as linked files: `npm run check:docs` rejects large images embedded in Markdown.
