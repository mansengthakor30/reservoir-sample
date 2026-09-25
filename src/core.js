/**
 * Reservoir sampling core implementation.
 *
 * Algorithm R (Waterman, Knuth TAOCP vol 2, 3.4.2).
 * Given a stream of unknown length, keeps a sample of at most `k` items
 * where every seen item has equal probability (n choose k uniform) of being
 * in the final sample.
 *
 * Design choice: the RNG is injected, not imported. This keeps the module
 * pure and lets tests pass a deterministic PRNG. Production callers pass
 * Math.random; tests pass a seeded LCG so every assertion is reproducible.
 */

/**
 * Linear congruential generator used by tests. Not exported as part of the
 * public API of core, but re-exported from index for the test file to import.
 *
 * Parameters are the classic glibc LCG constants. Good enough statistical
 * properties for deterministic testing; we never claim cryptographic quality.
 *
 * @param {number} seed  Non-negative 32-bit integer.
 * @returns {() => number} A function returning a float in [0, 1).
 */
export function makeLcg(seed) {
  let state = seed >>> 0;
  return function next() {
    // a = 1103515245, c = 12345, m = 2^31
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    // Use the high 16 bits for better bit distribution, then scale to [0,1).
    return (state >>> 16) / 65536;
  };
}

/**
 * A reservoir sampler.
 *
 * Call `feed(item)` once per stream element, in order. When the stream is
 * exhausted, `sample()` returns the reservoir as an array. The array is a
 * fresh copy each call, so callers may mutate it freely.
 */
export class Reservoir {
  #k;
  #rng;
  #reservoir;
  #seen;

  /**
   * @param {number} k            Reservoir capacity. Must be a positive integer.
   * @param {() => number} [rng]   Optional RNG returning a float in [0,1).
   *                              Defaults to Math.random. Injected so tests
   *                              can pass a deterministic generator.
   */
constructor(k, rng) {
    if (!Number.isInteger(k) || k <= 0) {
      throw new RangeError('Reservoir capacity k must be a positive integer');
    }
    this.#k = k;
    this.#rng = typeof rng === 'function' ? rng : Math.random;
    this.#reservoir = [];
    this.#seen = 0;
  }

  /**
   * Consume one stream element.
   *
   * For the first k items we fill the reservoir directly. For item i
   * (zero-indexed, i >= k) we pick j = floor(rng() * (i + 1)); if j < k we
   * replace reservoir[j].
   *
   * @param {*} item  One element from the stream.
   * @returns {void}
   */
  feed(item) {
    const i = this.#seen;
    if (i < this.#k) {
      this.#reservoir.push(item);
    } else {
      const j = Math.floor(this.#rng() * (i + 1));
      if (j < this.#k) {
        this.#reservoir[j] = item;
      }
    }
    this.#seen += 1;
  }

  /**
   * @returns {number} How many elements have been fed so far.
   */
  get seen() {
    return this.#seen;
  }

  /**
   * Current reservoir contents as a fresh array. Length is min(seen, k).
   *
   * @returns {Array}
   */
  sample() {
    return [...this.#reservoir];
  }
}

/**
 * Convenience helper: sample k items from any iterable in one pass.
 *
 * @param {Iterable} iterable
 * @param {number} k
 * @param {() => number} [rng]
 * @returns {Array}
 */
export function sampleIterable(iterable, k, rng) {
  const r = new Reservoir(k, rng);
  for (const item of iterable) {
    r.feed(item);
  }
  return r.sample();
}
