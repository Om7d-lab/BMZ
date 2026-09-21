# Vendored skills

These `.claude/skills/` are vendored (installed) from the third-party plugin
**ui-ux-pro-max** so they are available in every Claude Code session on this repo,
including Claude Code on the web (where the container is cloned fresh each time).

- Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Version installed: 2.13.0
- License: MIT (see `LICENSE.ui-ux-pro-max`)

The primary skill is `ui-ux-pro-max`: searchable local UI/UX design intelligence
(styles, palettes, typography, UX guidelines, charts, stacks). It is self-contained
— its data lives under `ui-ux-pro-max/data/` and its search tool is:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>
```

To update, re-copy the plugin's `.claude/skills/` over this directory.
