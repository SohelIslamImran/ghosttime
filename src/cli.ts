#!/usr/bin/env node

import process from "process";
import { Animation } from "./animation";
import { ANIMATION_DATA } from "./animation-data";
import readline from "readline";

const MICROS_PER_FRAME = 30_000;
const FRAME_DELAY = MICROS_PER_FRAME / 1000; // convert to milliseconds
const MAX_FRAME_SKIP = 3; // Maximum number of frames to skip if behind schedule
const CLEAR_AND_HOME = "\x1b[2J\x1b[H";
const DEFAULT_DURATION = 0; // 0 means run indefinitely

// Color mapping
const colorMap: Record<string, string> = {
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  // Bright variants
  brightblack: "\x1b[90m",
  brightred: "\x1b[91m",
  brightgreen: "\x1b[92m",
  brightyellow: "\x1b[93m",
  brightblue: "\x1b[94m",
  brightmagenta: "\x1b[95m",
  brightcyan: "\x1b[96m",
  brightwhite: "\x1b[97m",
};

function showColorHelp() {
  console.log("\nAvailable colors:");
  console.log("----------------");
  for (const [name, code] of Object.entries(colorMap)) {
    console.log(`${code}${name}\x1b[0m`);
  }
  console.log("\nUsage:");
  console.log(
    "  ghosttime -c <color>        Use a color name from the list above"
  );
  console.log(
    "  ghosttime -c <number>       Use an ANSI color code (30-37 or 90-97)"
  );
  console.log("  ghosttime --colors          Show this color help");
  console.log("  ghosttime --select-color    Interactively select a color");
  console.log(
    "  ghosttime -t <seconds>      Run animation for specified duration"
  );
  console.log(
    "  ghosttime --no-focus-pause  Prevent animation from pausing when terminal loses focus"
  );
  process.exit(0);
}

async function selectColorInteractively(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\nAvailable colors:");
  console.log("----------------");

  const colors = Object.entries(colorMap);
  for (const [index, [name, code]] of colors.entries()) {
    console.log(`${index + 1}. ${code}${name}\x1b[0m`);
  }

  return new Promise((resolve) => {
    rl.question(`\nSelect a color (1-${colors.length}): `, (answer) => {
      const index = Number.parseInt(answer) - 1;
      if (index >= 0 && index < colors.length) {
        resolve(colors[index][1]);
      } else {
        resolve("\x1b[34m"); // Default to blue if invalid selection
      }
    });
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
let colorArg = "\x1b[34m"; // Default blue color
let durationInSeconds = DEFAULT_DURATION;
let pauseOnFocusLost = true; // Default behavior is to pause when focus is lost

async function parseArgs() {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--colors" || args[i] === "-h" || args[i] === "--help") {
      showColorHelp();
    } else if (args[i] === "--select-color") {
      colorArg = await selectColorInteractively();
    } else if (args[i] === "--color" || args[i] === "-c") {
      const color = args[i + 1];
      if (color) {
        if (color.startsWith("\x1b[")) {
          colorArg = color;
        } else if (/^\d+$/.test(color)) {
          // If it's a number, treat it as an ANSI color code
          colorArg = `\x1b[${color}m`;
        } else {
          colorArg = colorMap[color.toLowerCase()] || "\x1b[34m";
        }
        i++; // Skip next argument
      }
    } else if (args[i] === "--timer" || args[i] === "-t") {
      const duration = args[i + 1];
      if (duration && /^\d+$/.test(duration)) {
        durationInSeconds = Number.parseInt(duration);
        i++; // Skip next argument
      }
    } else if (args[i] === "--no-focus-pause" || args[i] === "-nf") {
      pauseOnFocusLost = false;
    }
  }
}

// Pre-calculate terminal dimensions
let terminalHeight = process.stdout.rows || 24;
let terminalWidth = process.stdout.columns || 80;
let isTerminalFocused = true;
let shouldRender = true;

// Pre-calculate padding strings for different terminal widths
const paddingCache = new Map<number, string>();
const newlineCache = new Map<number, string>();

// Buffer for frame rendering
const outputBuffer = new Uint8Array(1024 * 64); // 64KB buffer for output
let outputPosition = 0;
let lastFrameIndex = -1; // Track last rendered frame to avoid re-rendering same frame
let lastVerticalPadding = 0;
let lastHorizontalPadding = 0;

// Setup raw mode for keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

function cleanup() {
  // Disable focus reporting, show cursor and restore main screen buffer
  process.stdout.write("\x1b[?1004l\x1b[?25h\x1b[?1049l");
  process.exit(0);
}

// Handle cleanup on exit
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

// Handle focus events using raw input
process.stdin.on("data", (data) => {
  const input = data.toString();
  if (input === "\x1b[I") {
    isTerminalFocused = true;
  } else if (input === "\x1b[O") {
    isTerminalFocused = false;
  }
});

// Handle keyboard input
process.stdin.on("keypress", (str, key) => {
  if (key.name === "q" || (key.ctrl && key.name === "c")) {
    cleanup();
  }
});

// Handle terminal resize
process.stdout.on("resize", () => {
  terminalHeight = process.stdout.rows || 24;
  terminalWidth = process.stdout.columns || 80;
  shouldRender = true;
  // Clear caches on resize
  paddingCache.clear();
  newlineCache.clear();
});

function getCachedString(
  cache: Map<number, string>,
  width: number,
  generator: (w: number) => string
): string {
  let str = cache.get(width);
  if (!str) {
    str = generator(width);
    cache.set(width, str);
  }
  return str;
}

function getPaddingString(width: number): string {
  return getCachedString(paddingCache, width, (w) => " ".repeat(w));
}

function getNewlineString(count: number): string {
  return getCachedString(newlineCache, count, (c) => "\n".repeat(c));
}

function writeToBuffer(str: string) {
  const bytes = Buffer.from(str);
  const len = bytes.length;
  if (outputPosition + len > outputBuffer.length) {
    // If buffer is full, flush it
    process.stdout.write(outputBuffer.subarray(0, outputPosition));
    outputPosition = 0;
  }
  outputBuffer.set(bytes, outputPosition);
  outputPosition += len;
}

function flushBuffer() {
  if (outputPosition > 0) {
    process.stdout.write(outputBuffer.subarray(0, outputPosition));
    outputPosition = 0;
  }
}

function renderFrame(frameIndex: number) {
  const verticalPadding = Math.max(
    0,
    Math.floor((terminalHeight - Animation.IMAGE_HEIGHT) / 2)
  );
  const horizontalPadding = Math.max(
    0,
    Math.floor((terminalWidth - Animation.IMAGE_WIDTH) / 2)
  );

  // Only recalculate padding if dimensions changed
  const paddingChanged =
    verticalPadding !== lastVerticalPadding ||
    horizontalPadding !== lastHorizontalPadding;
  if (paddingChanged) {
    lastVerticalPadding = verticalPadding;
    lastHorizontalPadding = horizontalPadding;
    shouldRender = true;
  }

  // If nothing changed, skip rendering
  if (!shouldRender && frameIndex === lastFrameIndex) {
    return;
  }

  // Get cached padding strings
  const paddingStr = getPaddingString(horizontalPadding);
  const verticalPaddingStr = getNewlineString(verticalPadding);

  // Start fresh buffer
  outputPosition = 0;

  // Clear screen and move cursor to home
  writeToBuffer(CLEAR_AND_HOME);

  // Add vertical padding
  if (verticalPadding > 0) {
    writeToBuffer(verticalPaddingStr);
  }

  // Get pre-split lines and render
  const lines = Animation.getFrameLines(frameIndex);
  for (let i = 0; i < lines.length; i++) {
    writeToBuffer(paddingStr);
    writeToBuffer(lines[i]);
    if (i < lines.length - 1) {
      writeToBuffer("\n");
    }
  }

  // Flush the buffer to stdout
  flushBuffer();
  shouldRender = false;
  lastFrameIndex = frameIndex;
}

async function runAnimation() {
  const start = performance.now();
  let lastFrameTime = start;
  let focusLostTime = 0;
  let totalPausedTime = 0;

  while (true) {
    const now = performance.now();

    // Check if duration has elapsed (if timer is set)
    const elapsed = now - start - totalPausedTime;
    if (durationInSeconds > 0 && elapsed >= durationInSeconds * 1000) {
      cleanup();
      return;
    }

    // Track paused time when focus changes (only if pauseOnFocusLost is true)
    if (pauseOnFocusLost) {
      if (!isTerminalFocused && focusLostTime === 0) {
        focusLostTime = now;
        shouldRender = true;
      } else if (isTerminalFocused && focusLostTime > 0) {
        totalPausedTime += now - focusLostTime;
        focusLostTime = 0;
        shouldRender = true;
      }
    }

    // Calculate frame index based on actual animation time (excluding paused time)
    const effectiveElapsed = now - start - totalPausedTime;
    const frameIndex =
      Math.floor(effectiveElapsed / FRAME_DELAY) % Animation.frameCount;

    // Check if we're falling behind
    const expectedFrame = Math.floor(
      (now - start - totalPausedTime) / FRAME_DELAY
    );
    const actualFrame = Math.floor(
      (lastFrameTime - start - totalPausedTime) / FRAME_DELAY
    );
    const behind = expectedFrame - actualFrame;

    // Only render if focused (or if pauseOnFocusLost is false) and either it's a new frame or we're catching up
    if (
      (isTerminalFocused || !pauseOnFocusLost) &&
      (frameIndex !== lastFrameIndex || behind > 0 || shouldRender)
    ) {
      // Skip frames if we're too far behind
      if (behind > MAX_FRAME_SKIP) {
        totalPausedTime += (behind - 1) * FRAME_DELAY; // Adjust pause time to catch up
      }

      // Render frame
      renderFrame(frameIndex);
    }

    // Calculate precise sleep time
    const nextFrameTime =
      start + totalPausedTime + (frameIndex + 1) * FRAME_DELAY;
    const sleepTime = Math.max(1, nextFrameTime - now); // Ensure minimum 1ms sleep

    // Wait for next frame
    await new Promise((resolve) => setTimeout(resolve, sleepTime));
    lastFrameTime = now;
  }
}

// Initialize and start the animation
async function main() {
  // Parse arguments after terminal setup
  await parseArgs();

  // Set the highlight color before initializing
  Animation.setHighlightColor(colorArg);

  // Initialize animation with data
  Animation.initialize(ANIMATION_DATA);

  // Enable alternative screen buffer, hide cursor, and enable focus reporting first
  process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[?1004h");

  // Start the animation
  runAnimation().catch((error: Error) => {
    console.error(error);
    cleanup();
  });
}

main();
