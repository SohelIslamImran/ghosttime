#!/usr/bin/env node

import { Animation } from "./animation";
import { ANIMATION_DATA } from "./animation-data";
import readline from "readline";

const MICROS_PER_FRAME = 30_000;
const FRAME_DELAY = MICROS_PER_FRAME / 1000; // convert to milliseconds

// Initialize animation with data
Animation.initialize(ANIMATION_DATA);

// Enable alternative screen buffer, hide cursor, and enable focus reporting
process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[?1004h");

// Setup raw mode for keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

// Pre-calculate terminal dimensions
let terminalHeight = process.stdout.rows || 24;
let terminalWidth = process.stdout.columns || 80;
let isTerminalFocused = true;

// Buffer for frame rendering
let frameBuffer = "";

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
  // Focus gained: ESC [ I
  // Focus lost: ESC [ O
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
});

function renderFrame(frameContent: string) {
  const verticalPadding = Math.max(
    0,
    Math.floor((terminalHeight - Animation.IMAGE_HEIGHT) / 2)
  );
  const horizontalPadding = Math.max(
    0,
    Math.floor((terminalWidth - Animation.IMAGE_WIDTH) / 2)
  );

  // Create horizontal padding once
  const paddingStr = " ".repeat(horizontalPadding);

  // Clear screen and move cursor to home
  frameBuffer = "\x1b[2J\x1b[H";

  // Add vertical padding
  if (verticalPadding > 0) {
    frameBuffer += "\n".repeat(verticalPadding);
  }

  // Add frame content with horizontal padding
  const lines = frameContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    frameBuffer += paddingStr + lines[i];
    // Add newline for all lines except the last one
    if (i < lines.length - 1) {
      frameBuffer += "\n";
    }
  }

  // Write the entire frame at once
  process.stdout.write(frameBuffer);
}

async function runAnimation() {
  const start = Date.now();
  let lastFrameTime = start;
  let focusLostTime = 0;
  let totalPausedTime = 0;

  while (true) {
    const now = Date.now();

    // Track paused time when focus changes
    if (!isTerminalFocused && focusLostTime === 0) {
      focusLostTime = now;
    } else if (isTerminalFocused && focusLostTime > 0) {
      totalPausedTime += now - focusLostTime;
      focusLostTime = 0;
    }

    // Calculate frame index based on actual animation time (excluding paused time)
    const effectiveElapsed = now - start - totalPausedTime;
    const frameIndex =
      Math.floor(effectiveElapsed / FRAME_DELAY) % Animation.frameCount;

    // Only render new frames if the terminal is focused
    if (isTerminalFocused) {
      // Get and render frame
      const frame = Animation.getFrame(frameIndex);
      renderFrame(frame);
    }

    // Calculate precise sleep time
    const nextFrameTime =
      start + totalPausedTime + (frameIndex + 1) * FRAME_DELAY;
    const sleepTime = Math.max(0, nextFrameTime - now);

    // Wait for next frame
    await new Promise((resolve) => setTimeout(resolve, sleepTime));
    lastFrameTime = now;
  }
}

// Start the animation
runAnimation().catch((error) => {
  console.error(error);
  cleanup();
});
