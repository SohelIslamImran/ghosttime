interface Frame {
  lines: string[]; // Pre-split lines for faster access
}

type AnimationData = string[][]; // Complete animation sequence

export class Animation {
  private static frames: Frame[] = [];
  private static highlightColor = "\x1b[34m"; // Default to blue
  private static readonly RESET_COLOR = "\x1b[0m";
  private static readonly COLOR_START_TAG = "<color>";
  private static readonly COLOR_END_TAG = "</color>";
  private static readonly COLOR_START_LEN = Animation.COLOR_START_TAG.length;
  private static readonly COLOR_END_LEN = Animation.COLOR_END_TAG.length;

  static readonly IMAGE_WIDTH = 77;
  static readonly IMAGE_HEIGHT = 41;

  static setHighlightColor(color: string) {
    this.highlightColor = color;
  }

  static initialize(animationData: AnimationData) {
    // Pre-calculate all frames with ANSI codes
    this.frames = animationData.map((frameLines) => {
      // Process each line of the frame
      const processedLines = frameLines.map((line) => {
        const parts: string[] = [];
        let currentIndex = 0;

        while (true) {
          const colorStart = line.indexOf(this.COLOR_START_TAG, currentIndex);
          if (colorStart === -1) {
            // No more color tags, add remaining content
            if (currentIndex < line.length) {
              parts.push(line.slice(currentIndex));
            }
            break;
          }

          // Add content before color tag
          if (colorStart > currentIndex) {
            parts.push(line.slice(currentIndex, colorStart));
          }

          // Find the end of colored section
          const contentStart = colorStart + this.COLOR_START_LEN;
          const colorEnd = line.indexOf(this.COLOR_END_TAG, contentStart);
          if (colorEnd === -1) {
            // Malformed tag, just add the rest
            parts.push(line.slice(currentIndex));
            break;
          }

          // Add colored content
          parts.push(
            this.highlightColor,
            line.slice(contentStart, colorEnd),
            this.RESET_COLOR
          );

          currentIndex = colorEnd + this.COLOR_END_LEN;
        }

        return parts.join("");
      });

      return {
        lines: processedLines, // Store pre-split lines for faster rendering
      };
    });
  }

  static getFrameLines(index: number): string[] {
    return this.frames[index].lines;
  }

  static get frameCount(): number {
    return this.frames.length;
  }
}

// You'll need to initialize this with your ANIMATION_DATA
// Animation.initialize(ANIMATION_DATA);
