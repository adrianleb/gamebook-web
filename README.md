# Gamebook Web

A browser-based RPG/adventure game adapted from the original [gamebook repository](https://github.com/adrianleb/gamebook), presented with an old-school DOS / LucasArts-style aesthetic featuring chunky UI, pixel-style presentation, strong dialogue scenes, inventory interactions, and punchy SFX.

## Features

- **Complete Story Experience**: 176 story nodes across 3 acts with 5 distinct endings
- **DOS-Era Presentation**: Keyboard-friendly, high-contrast UI with retro typography
- **Data-Driven Content**: All scenes, choices, and effects are declarative
- **Save System**: 3 save slots plus autosave with versioned format
- **Audio Integration**: UI sound effects and background music with volume controls
- **Fully Playable**: No dead ends - every path leads somewhere

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/adrianleb/gamebook-web.git
cd gamebook-web

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run lint` | Lint source files |
| `npm run typecheck` | Type check without emitting |
| `npm run validate:content` | Validate story content |
| `npm run validate:assets` | Validate audio assets |

## How to Play

### Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Navigate choices |
| Enter | Confirm selection |
| Escape | Open pause menu / Go back |
| 1-9 | Quick select choices |
| I | Open inventory |

### Game Loop

1. **Title Screen**: Start a new game or load a saved game
2. **Gameplay**: Read story text, make choices, manage inventory
3. **Save/Load**: Access from pause menu (Escape)
4. **Endings**: Reach one of 5 different endings based on your choices

### The Five Endings

Your choices throughout the game determine which ending you achieve:

1. **Victory**: Lead your faction to triumph through alliances and artifacts
2. **Sacrifice**: Give everything to save those you love
3. **Betrayal**: Embrace darkness for power at any cost
4. **Neutral**: Walk the middle path between all factions
5. **Death**: Some paths lead only to doom

## Project Structure

```
gamebook-web/
├── docs/               # Design documentation
│   ├── GDD.md          # Game Design Document
│   ├── STORY.md        # Story map and branching logic
│   ├── ENGINE.md       # Engine architecture
│   ├── UI.md           # UI/UX specifications
│   ├── AUDIO.md        # Audio system design
│   └── QA.md           # Quality assurance plan
├── src/
│   ├── engine/         # Game engine (state machine, save/load)
│   ├── content/        # Compiled story content
│   ├── ui/             # UI components and screens
│   ├── assets/         # Fonts, images, audio
│   └── tools/          # Content validators and analyzers
├── tests/              # Unit and integration tests
├── CREDITS.md          # Third-party asset credits
├── GANG.md             # Multi-agent coordination contract
└── package.json
```

## Documentation

- [Game Design Document](docs/GDD.md) - Vision, systems, and milestones
- [Story Map](docs/STORY.md) - All nodes, endings, and dependencies
- [Engine Specification](docs/ENGINE.md) - State model and save format
- [UI Specification](docs/UI.md) - Screen flows and interaction patterns
- [Audio Plan](docs/AUDIO.md) - Sound effects and music integration
- [QA Plan](docs/QA.md) - Test scenarios and validation

## Development

This project was developed using a multi-agent workflow documented in [GANG.md](GANG.md). Each agent owns specific domains:

- **Agent A**: Integration, repo health, release readiness
- **Agent B**: Narrative accuracy, dialogue, branching integrity
- **Agent C**: Engine design, state machine, save system
- **Agent D**: UI patterns, visual language, accessibility
- **Agent E**: Audio pipeline, asset organization
- **Agent F**: QA strategy, playthrough validation

## Credits

See [CREDITS.md](CREDITS.md) for third-party asset attributions. All audio assets are licensed under CC0 (Creative Commons Zero).

## License

This project adapts content from the original [gamebook repository](https://github.com/adrianleb/gamebook).
