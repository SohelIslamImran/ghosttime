#!/usr/bin/env node

import { Animation } from "./animation";
import { ANIMATION_DATA } from "./animation-data";
import readline from "readline";

const MICROS_PER_FRAME = 30_000;
const FRAME_DELAY = MICROS_PER_FRAME / 1000; // convert to milliseconds
const MAX_FRAME_SKIP = 3; // Maximum number of frames to skip if behind schedule

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

// Pre-calculate padding strings for different terminal widths
const paddingCache = new Map<number, string>();

// Buffer for frame rendering
let frameBuffer = "";
let lastFrameIndex = -1; // Track last rendered frame to avoid re-rendering same frame

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
  // Clear padding cache on resize
  paddingCache.clear();
});

function getPaddingString(width: number): string {
  if (!paddingCache.has(width)) paddingCache.set(width, " ".repeat(width));
  return paddingCache.get(width)!;
}

function renderFrame(frameContent: string) {
  const verticalPadding = Math.max(
    0,
    Math.floor((terminalHeight - Animation.IMAGE_HEIGHT) / 2)
  );
  const horizontalPadding = Math.max(
    0,
    Math.floor((terminalWidth - Animation.IMAGE_WIDTH) / 2)
  );

  // Get cached padding string
  const paddingStr = getPaddingString(horizontalPadding);

  // Build frame buffer efficiently
  const parts: string[] = [
    // Clear screen and move cursor to home
    "\x1b[2J\x1b[H",
  ];

  // Add vertical padding
  if (verticalPadding > 0) {
    parts.push("\n".repeat(verticalPadding));
  }

  // Add frame content with horizontal padding
  const lines = frameContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    parts.push(paddingStr, lines[i]);
    if (i < lines.length - 1) {
      parts.push("\n");
    }
  }

  // Join all parts and write at once
  frameBuffer = parts.join("");
  process.stdout.write(frameBuffer);
}

async function runAnimation() {
  const start = Date.now();
  let lastFrameTime = start;
  let focusLostTime = 0;
  let totalPausedTime = 0;
  let skippedFrames = 0;

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

    // Check if we're falling behind
    const expectedFrame = Math.floor(
      (now - start - totalPausedTime) / FRAME_DELAY
    );
    const actualFrame = Math.floor(
      (lastFrameTime - start - totalPausedTime) / FRAME_DELAY
    );
    const behind = expectedFrame - actualFrame;

    // Only render if focused and either it's a new frame or we're catching up
    if (isTerminalFocused && (frameIndex !== lastFrameIndex || behind > 0)) {
      // Skip frames if we're too far behind
      if (behind > MAX_FRAME_SKIP) {
        skippedFrames += behind - 1;
        totalPausedTime += (behind - 1) * FRAME_DELAY; // Adjust pause time to catch up
      }

      // Get and render frame
      const frame = Animation.getFrame(frameIndex);
      renderFrame(frame);
      lastFrameIndex = frameIndex;
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

// Start the animation
runAnimation().catch((error) => {
  console.error(error);
  cleanup();
});
