#!/usr/bin/env node

import { Animation } from './animation';
import { ANIMATION_DATA } from './animation-data';
import readline from 'readline';

const MICROS_PER_FRAME = 30_000;
const FRAME_DELAY = MICROS_PER_FRAME / 1000; // convert to milliseconds

// Initialize animation with data
Animation.initialize(ANIMATION_DATA);

// Enable alternative screen buffer
process.stdout.write('\x1b[?1049h');

// Setup raw mode for keyboard input
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

async function runAnimation() {
  // Hide cursor and clear screen
  process.stdout.write('\x1b[?25l');
  process.stdout.write('\x1b[2J');

  const start = Date.now();

  const cleanup = () => {
    // Show cursor and restore main screen buffer
    process.stdout.write('\x1b[?25h');
    process.stdout.write('\x1b[?1049l');
    process.exit(0);
  };

  // Handle cleanup on exit
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  // Handle keyboard input
  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      cleanup();
    }
  });

  while (true) {
    // Calculate frame based on elapsed time (like in Rust version)
    const elapsed = Date.now() - start;
    const frameIndex = Math.floor(elapsed / FRAME_DELAY) % Animation.frameCount;

    // Clear screen and move cursor to top-left
    process.stdout.write('\x1b[2J\x1b[H');

    // Get frame content
    const frame = Animation.getFrame(frameIndex);

    // Center the frame vertically and horizontally
    const terminalHeight = process.stdout.rows || 24;
    const terminalWidth = process.stdout.columns || 80;
    const verticalPadding = Math.max(0, Math.floor((terminalHeight - Animation.IMAGE_HEIGHT) / 2));
    const horizontalPadding = Math.max(0, Math.floor((terminalWidth - Animation.IMAGE_WIDTH) / 2));

    // Add padding
    const paddedFrame = frame.split('\n').map(line =>
      ' '.repeat(horizontalPadding) + line
    );

    // Add vertical padding
    const finalOutput = '\n'.repeat(verticalPadding) + paddedFrame.join('\n');

    // Write frame
    process.stdout.write(finalOutput);

    // Wait for next frame
    await new Promise(resolve => setTimeout(resolve, FRAME_DELAY));
  }
}

// Start the animation
runAnimation().catch(error => {
  console.error(error);
  // Ensure we cleanup on error
  process.stdout.write('\x1b[?25h');
  process.stdout.write('\x1b[?1049l');
  process.exit(1);
});