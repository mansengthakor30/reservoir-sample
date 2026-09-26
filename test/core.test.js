import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { Reservoir, sampleIterable, makeLcg } from '../src/index.js';

// Deterministic PRNG shared by tests that need reproducible draws.
const lcg = (seed) => makeLcg(seed);

describe('Reservoir construction', () => {
  it('rejects zero and negative capacity', () => {
    assert.throws(() => new Reservoir(0), RangeError);
    assert.throws(() => new Reservoir(-3), RangeError);
  });

  it('rejects non-integer capacity', () => {
    assert.throws(() => new Reservoir(2.5), RangeError);
    assert.throws(() => new Reservoir('3'), RangeError);
    assert.throws(() => new Reservoir(NaN), RangeError);
  });

  it('accepts a custom rng and defaults to Math.random', () => {
    // Smoke test: both forms construct without throwing.
    new Reservoir(2);            // uses Math.random
    new Reservoir(2, lcg(1));    // uses deterministic generator
  });
});

describe('Stream shorter than k', () => {
  it('returns all items in feed order when stream is empty', () => {
    const r = new Reservoir(3, lcg(1));
    assert.deepEqual(r.sample(), []);
    assert.equal(r.seen, 0);
  });

  it('returns all items in feed order when stream is shorter than k', () => {
    const r = new Reservoir(5, lcg(1));
    r.feed('a');
    r.feed('b');
    assert.deepEqual(r.sample(), ['a', 'b']);
    assert.equal(r.seen, 2);
  });
});

describe('Stream of length k', () => {
  it('keeps every item in order when n equals k', () => {
    const r = new Reservoir(3, lcg(1));
    r.feed('a');
    r.feed('b');
    r.feed('c');
    assert.deepEqual(r.sample(), ['a', 'b', 'c']);
    assert.equal(r.seen, 3);
  });
});

describe('Stream longer than k', () => {
  it('always has exactly k items once n exceeds k', () => {
    const r = new Reservoir(3, lcg(7));
    for (let i = 0; i < 100; i++) r.feed(i);
    assert.equal(r.sample().length, 3);
    assert.equal(r.seen, 100);
  });

  it('is deterministic given a fixed seed', () => {
    const a = new Reservoir(4, lcg(42));
    const b = new Reservoir(4, lcg(42));
    for (let i = 0; i < 50; i++) {
      a.feed(i);
      b.feed(i);
    }
    assert.deepEqual(a.sample(), b.sample());
  });
});

describe('sample() returns a copy', () => {
  it('mutations to the returned array do not affect the sampler', () => {
    const r = new Reservoir(2, lcg(1));
    r.feed('x');
    r.feed('y');
    const out = r.sample();
    out.push('Z');
    out[0] = 'Q';
    assert.deepEqual(r.sample(), ['x', 'y']);
  });
});

describe('sampleIterable', () => {
  it('samples from any iterable, deterministically with a seeded rng', () => {
    const out1 = sampleIterable([10, 20, 30, 40, 50, 60], 3, lcg(99));
    const out2 = sampleIterable([10, 20, 30, 40, 50, 60], 3, lcg(99));
    assert.deepEqual(out1, out2);
    assert.equal(out1.length, 3);
    // All results must come from the source set.
    for (const v of out1) {
      assert.ok([10, 20, 30, 40, 50, 60].includes(v));
    }
  });

  it('works with a generator iterable', () => {
    function* gen() {
      yield 'p';
      yield 'q';
      yield 'r';
    }
    const out = sampleIterable(gen(), 2, lcg(1));
    assert.equal(out.length, 2);
    for (const v of out) {
      assert.ok(['p', 'q', 'r'].includes(v));
    }
  });

  it('returns fewer than k when the iterable is short', () => {
    const out = sampleIterable(['only'], 4, lcg(1));
    assert.deepEqual(out, ['only']);
  });

  it('returns an empty array for an empty iterable', () => {
    assert.deepEqual(sampleIterable([], 4, lcg(1)), []);
  });
});

describe('Uniformity (statistical, not exact)', () => {
  // We do not assert floating point equality. We assert integer counts of
  // how often each item survives, and check they are within a tolerance band.
  it('each item appears in roughly 1/n of draws over many runs', () => {
    const n = 10;     // stream size
    const k = 1;      // sample one item
    const runs = 20000;
    const counts = new Array(n).fill(0);
    // Each run needs its own rng seed; we advance the seed by run index so
    // every draw is deterministic and independent.
    for (let run = 0; run < runs; run++) {
      const r = new Reservoir(k, lcg(1000 + run));
      for (let i = 0; i < n; i++) r.feed(i);
      const picked = r.sample()[0];
      counts[picked] += 1;
    }
    // Expected count per item = runs / n = 2000.
    // For n=10, k=1, the true selection probability is exactly 1/10. With
    // 20000 runs the standard deviation of a binomial(20000, 0.1) is about
    // sqrt(20000 * 0.1 * 0.9) ≈ 42. We use a generous 4-sigma-ish band so
    // the test is robust against the LCG's modest quality.
    const expected = runs / n;
    const tolerance = 200;
    for (let i = 0; i < n; i++) {
      assert.ok(
        Math.abs(counts[i] - expected) <= tolerance,
        `item ${i}: count ${counts[i]} outside [${expected - tolerance}, ${expected + tolerance}]`
      );
    }
  });
});
