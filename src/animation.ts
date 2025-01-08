interface Frame {
  content: string;
}

export class Animation {
  private static frames: Frame[] = [];
  private static readonly BLUE_COLOR = "\x1b[34m";
  private static readonly RESET_COLOR = "\x1b[0m";

  static readonly IMAGE_WIDTH = 77;
  static readonly IMAGE_HEIGHT = 41;

  static initialize(animationData: string[][]) {
    // Pre-calculate all frames with ANSI codes
    this.frames = animationData.map((frameLines) => {
      // Process each line of the frame
      const processedLines = frameLines.map((line) => {
        let result = "";
        let isInColor = false;
        let currentChunk = "";

        // Process the line character by character
        for (let i = 0; i < line.length; i++) {
          if (line.slice(i, i + 7) === "<color>") {
            if (currentChunk) {
              result += currentChunk;
              currentChunk = "";
            }
            isInColor = true;
            i += 6; // Skip the <color> tag
            continue;
          }
          if (line.slice(i, i + 8) === "</color>") {
            if (currentChunk) {
              result += this.BLUE_COLOR + currentChunk + this.RESET_COLOR;
              currentChunk = "";
            }
            isInColor = false;
            i += 7; // Skip the </color> tag
            continue;
          }
          currentChunk += line[i];
        }

        // Handle any remaining chunk
        if (currentChunk) {
          result += isInColor
            ? this.BLUE_COLOR + currentChunk + this.RESET_COLOR
            : currentChunk;
        }

        return result;
      });

      // Join lines with proper line endings
      return {
        content: processedLines.join("\n"),
      };
    });
  }

  static getFrame(index: number): string {
    return this.frames[index].content;
  }

  static get frameCount(): number {
    return this.frames.length;
  }
}

// You'll need to initialize this with your ANIMATION_DATA
// Animation.initialize(ANIMATION_DATA);
