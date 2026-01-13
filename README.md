# pi-agent config

## Contents

- `settings.json` - agent settings
- `keybindings.json` - custom keybindings
- `extensions/` - custom tools (websearch, handoff, notification, theme)
- `skills/` - custom skills (pr-review-comments, resolve-pr-comment)
- `prompts/` - custom prompts

## Setup

```bash
git clone <repo-url> ~/.pi/agent
cd ~/.pi/agent/extensions && npm install
```

Create `~/.pi/agent/auth.json` with your credentials (not tracked).
