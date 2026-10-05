/** State is explicit so a restored authority continues the same random stream. */
export interface RandomService {
  next(): number;
  snapshot(): { algorithm: 'lcg32'; state: number };
}
export class SeededRandom implements RandomService {
  private state: number;
  constructor(seed = 1) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
    this.state = seed;
  }
  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  snapshot(): { algorithm: 'lcg32'; state: number } { return { algorithm: 'lcg32', state: this.state }; }
}
