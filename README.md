# Ghosttime Terminal Animation

Ghostty animation for your terminal with customizable colors.

![Ghosttime Demo](/ghostty.mp4)

### Install and run globally

```bash
npm install -g ghosttime
```

```bash
ghosttime
```

### Run without installing

```bash
npx ghosttime | bunx ghosttime
```

### Commands

```bash
# Show available colors and help
ghosttime --colors
ghosttime -h
ghosttime --help

# Use a specific color
ghosttime -c red
ghosttime --color blue
ghosttime --color brightcyan

# Use ANSI color code
ghosttime -c 32    # green
ghosttime -c 91    # bright red

# Interactive color selection
ghosttime --select-color
```

### Available Colors

- Standard Colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`
- Bright Colors: `brightblack`, `brightred`, `brightgreen`, `brightyellow`, `brightblue`, `brightmagenta`, `brightcyan`, `brightwhite`

### Controls

- Press `q` to quit
- Press `Ctrl+C` to exit
- Terminal focus controls animation pause/resume

### Features

- Smooth ghostty animation
- Customizable colors
- Interactive color selection
- Focus-aware (pauses when terminal loses focus)
- Automatically centers in terminal
- Efficient rendering with minimal CPU usage
