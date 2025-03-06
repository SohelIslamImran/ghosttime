# Ghosttime Terminal Animation

[Ghostty](https://ghostty.org) animation for any terminal with customizable colors. (Inspired from [ghostty.org](https://ghostty.org/))

<https://github.com/user-attachments/assets/231a128d-57c1-4e64-a3aa-49ca763139b1>

### Install and run globally

```bash
npm install -g ghosttime
```

```bash
ghosttime
```

### Run without installing

```bash
npx ghosttime
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

# Run with timer (duration in seconds)
ghosttime -t 30    # Run for 30 seconds
ghosttime --timer 60    # Run for 1 minute

# Continue animation even when terminal loses focus
ghosttime --no-focus-pause
# For short
ghosttime -nf
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
- Timer option for timed execution
- Focus-aware (pauses when terminal loses focus)
- Automatically centers in terminal
- Efficient rendering with minimal CPU usage
