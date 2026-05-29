export class TokenEstimator {
  estimate(text: string): number {
    if (!text) return 0;

    let count = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);

      if (code <= 0x7f) {
        count += 0.25;
      } else if (code <= 0x7ff) {
        count += 0.5;
      } else if (code <= 0xffff) {
        if (code >= 0x4e00 && code <= 0x9fff) {
          count += 1;
        } else {
          count += 0.75;
        }
      } else {
        count += 1;
      }
    }

    return Math.ceil(count);
  }
}

export const tokenEstimator = new TokenEstimator();