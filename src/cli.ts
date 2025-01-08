#!/usr/bin/env node

import { Animation } from "./animation";
import { ANIMATION_DATA } from "./animation-data";
import readline from "readline";

const MICROS_PER_FRAME = 30_000;
const FRAME_DELAY = MICROS_PER_FRAME / 1000; // convert to milliseconds
const MAX_FRAME_SKIP = 3; // Maximum number of frames to skip if behind schedule
const CLEAR_AND_HOME = "\x1b[2J\x1b[H";

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
let shouldRender = true;

// Pre-calculate padding strings for different terminal widths
const paddingCache = new Map<number, string>();
const newlineCache = new Map<number, string>();

// Buffer for frame rendering
const outputBuffer = new Uint8Array(1024 * 64); // 64KB buffer for output
let outputPosition = 0;
const textEncoder = new TextEncoder();
let lastFrameIndex = -1; // Track last rendered frame to avoid re-rendering same frame
let lastVerticalPadding = 0;
let lastHorizontalPadding = 0;

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
  const bytes = textEncoder.encode(str);
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
  // Skip if terminal is too small
  if (
    terminalWidth < Animation.IMAGE_WIDTH ||
    terminalHeight < Animation.IMAGE_HEIGHT
  ) {
    return;
  }

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
  let skippedFrames = 0;

  while (true) {
    const now = performance.now();

    // Track paused time when focus changes
    if (!isTerminalFocused && focusLostTime === 0) {
      focusLostTime = now;
      shouldRender = true;
    } else if (isTerminalFocused && focusLostTime > 0) {
      totalPausedTime += now - focusLostTime;
      focusLostTime = 0;
      shouldRender = true;
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
    if (
      isTerminalFocused &&
      (frameIndex !== lastFrameIndex || behind > 0 || shouldRender)
    ) {
      // Skip frames if we're too far behind
      if (behind > MAX_FRAME_SKIP) {
        skippedFrames += behind - 1;
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

// Start the animation
runAnimation().catch((error) => {
  console.error(error);
  cleanup();
});
