interface TextSpan {
  content: string;
  isColored: boolean;
}

interface Frame {
  lines: TextSpan[][];
}

export class Animation {
  private static frames: Frame[] = [];
  private static readonly BLUE_COLOR = '\x1b[34m';
  private static readonly RESET_COLOR = '\x1b[0m';

  static readonly IMAGE_WIDTH = 77;
  static readonly IMAGE_HEIGHT = 41;

  static initialize(animationData: string[][]) {
    this.frames = animationData.map(frame => {
      const lines = frame.map((line: string) => {
        const spans: TextSpan[] = [];
        const chunks = line.split('<color>').flatMap(x => x.split('</color>'));

        chunks.forEach((chunk, i) => {
          spans.push({
            content: chunk,
            isColored: i % 2 === 1
          });
        });

        return spans;
      });

      return { lines };
    });
  }

  static getFrame(index: number): string {
    const frame = this.frames[index];
    return frame.lines
      .map(line =>
        line.map((span: TextSpan) =>
          span.isColored
            ? `${this.BLUE_COLOR}${span.content}${this.RESET_COLOR}`
            : span.content
        ).join('')
      )
      .join('\n');
  }

  static get frameCount(): number {
    return this.frames.length;
  }
}

// You'll need to initialize this with your ANIMATION_DATA
// Animation.initialize(ANIMATION_DATA);