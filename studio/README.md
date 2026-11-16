# Creative Studio

The creative-director setup for Claude Code: a permanent operating standard plus a curated,
pinned set of design, motion, video, branding and quality skills, installed globally into
`~/.claude` so it applies to every project.

| File | Purpose |
|---|---|
| `CLAUDE.md` | The creative brain: brief, principles, discipline standards, skill routing, quality gate. Installed as a marked block inside `~/.claude/CLAUDE.md` (other content in that file is kept). |
| `install.sh` | Installs or refreshes everything from pinned commits. `--verify` checks the install. |
| `skills/creative-review` | The studio's own final quality gate skill. |

The cloud environment's setup script runs `install.sh` on every new container, so nothing needs
to be done by hand. To change the standard, edit `CLAUDE.md` here and commit.

## Sources (pinned)

| Repository | Installed | Method |
|---|---|---|
| pbakaus/impeccable | `impeccable` + 5 agents + design hook | repo's committed Claude Code build (documented manual install); engine binary checksum-verified from GitHub Releases |
| anthropics/skills | `canvas-design` (`frontend-design` comes from the existing plugin, identical file) | folder copy |
| vercel-labs/agent-skills | `web-design-guidelines` | folder copy |
| emilkowalski/skills | 19 design-engineering and animation skills (all except `write-swift`) | folder copy |
| adamperlis/video-skills | all 12 video skills | folder copy |
| obra/superpowers | `brainstorming`, `writing-plans`, `executing-plans`, `verification-before-completion`, `systematic-debugging`, `requesting-code-review` + the 4 skills they reference | folder copy |
| Leonxlnx/taste-skill | `design-taste-frontend` | folder copy |
| nextlevelbuilder/ui-ux-pro-max-skill | `ui-ux-pro-max`, `design`, `design-system`, `brand`, `banner-design`, `slides`, `ui-styling` | official `uipro` CLI 2.15.0 |

Folder copies are byte-identical to what each project's own installer (`npx skills add`) produces;
this was checked at install time.
