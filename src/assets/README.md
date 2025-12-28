# Assets Directory

This directory contains all game assets organized by type.

## Audio Assets

See `/docs/AUDIO.md` for complete audio specification.

### Directory Structure

```
audio/
  sfx/       - Sound effects (<100KB each, .ogg format)
  music/     - Background music (<2MB each, .ogg format)
  ambience/  - Ambient loops (optional)
```

### Naming Conventions

- **Lowercase with underscores**: `menu_select.ogg`, not `MenuSelect.ogg`
- **No spaces or special characters**
- **Descriptive names**: Match the sound purpose

### Required SFX Files

| File | Purpose |
|------|---------|
| `menu_move.ogg` | Menu navigation |
| `menu_select.ogg` | Confirm selection |
| `menu_back.ogg` | Cancel/back |
| `menu_error.ogg` | Invalid action |
| `choice_hover.ogg` | Choice highlight |
| `choice_select.ogg` | Story choice confirmed |
| `page_turn.ogg` | Scene transition |
| `inventory_open.ogg` | Open inventory |
| `inventory_close.ogg` | Close inventory |
| `item_pickup.ogg` | Item acquired |
| `item_use.ogg` | Item used |
| `save.ogg` | Game saved |
| `load.ogg` | Game loaded |
| `stat_up.ogg` | Stat increase |
| `stat_down.ogg` | Stat decrease |
| `game_over.ogg` | Failure ending |
| `victory.ogg` | Victory ending |

### Required Music Files

| File | Purpose |
|------|---------|
| `title.ogg` | Title screen |
| `exploration.ogg` | General gameplay |
| `tension.ogg` | Dangerous situations |
| `victory.ogg` | Success ending |
| `defeat.ogg` | Failure ending |

### Validation

Run the asset validation script to check compliance:

```bash
node src/tools/validate-assets.js
```

Options:
- `--force` - Continue build even on errors
- `--warn-only` - Report issues as warnings

Exit codes:
- `0` - All validations passed
- `1` - Errors found (blocking)
- `2` - Warnings found

### Configuration

Edit `asset-validation.config.json` at the project root to customize:
- Size limits
- Required file lists
- Allowed formats

## Licensing

All assets must be license-compatible (CC0, CC-BY, or purchased).
Document sources in `/docs/audio-licenses.md`.
