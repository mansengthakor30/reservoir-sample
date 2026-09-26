# Reservoir Sample

One-pass uniform sampling from streams of any length, in pure ESM JavaScript with zero dependencies.

```js
import { Reservoir, sampleIterable } from 'reservoir-sample';

// From a stream of unknown length, keep 3 uniformly-chosen items:
const picks = sampleIterable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);

// Or drive the sampler yourself, element by element:
const r = new Reservoir(3);
for (const row of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) r.feed(row);
console.log(r.sample()); // up to 3 items, uniformly chosen
```

## Why this exists

You have a stream — a database cursor, a log file, a generator — whose length you do not know in advance, and you want `k` uniformly random items from it without holding the whole thing in memory. Reservoir sampling (Algorithm R) does this in one pass with O(k) memory: it keeps the first `k` items, then for each later item at index `i` it replaces a random slot with probability `k / (i + 1)`. The proof that this yields a uniform `n choose k` sample is standard (Knuth, TAOCP vol. 2, 3.4.2).

The trade-off: the reservoir is an array of length `k`, and every item after the first `k` costs one RNG draw plus an occasional array write. If `k` is large and the stream is short, you pay for capacity you never use; if `k` is tiny, the per-item cost is essentially one random number. There is no way around that with Algorithm R.

## Edge you will hit

`sample()` returns a *copy* of the reservoir each call — mutate it freely, it will not corrupt the sampler. If you feed fewer than `k` items, `sample()` returns exactly those items, in feed order — it does **not** pad to length `k`. An empty stream yields `[]`, not an array of `undefined`.

The RNG is injectable. Pass a function returning a float in `[0, 1)` as the second argument to the `Reservoir` constructor or to `sampleIterable`; it defaults to `Math.random`. For deterministic tests, `makeLcg(seed)` builds a seeded linear-congruential generator. The exports are exactly: `Reservoir`, `sampleIterable`, `makeLcg`.

Capacity `k` must be a positive integer; anything else throws `RangeError` at construction time.
