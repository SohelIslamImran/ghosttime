#!/usr/bin/env node

import { Animation } from "./animation";
import { ANIMATION_DATA } from "./animation-data";
import readline from "readline";

const MICROS_PER_FRAME = 30_000;
const FRAME_DELAY = MICROS_PER_FRAME / 1000; // convert to milliseconds

// Initialize animation with data
Animation.initialize(ANIMATION_DATA);

// Enable alternative screen buffer and hide cursor
process.stdout.write("\x1b[?1049h\x1b[?25l");

// Setup raw mode for keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

// Pre-calculate terminal dimensions
let terminalHeight = process.stdout.rows || 24;
let terminalWidth = process.stdout.columns || 80;

// Buffer for frame rendering
let frameBuffer = "";

function cleanup() {
  // Show cursor and restore main screen buffer
  process.stdout.write("\x1b[?25h\x1b[?1049l");
  process.exit(0);
}

// Handle cleanup on exit
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

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

  while (true) {
    const now = Date.now();
    const elapsed = now - start;

    // Calculate frame index
    const frameIndex = Math.floor(elapsed / FRAME_DELAY) % Animation.frameCount;

    // Get and render frame
    const frame = Animation.getFrame(frameIndex);
    renderFrame(frame);

    // Calculate precise sleep time
    const nextFrameTime = start + (frameIndex + 1) * FRAME_DELAY;
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
