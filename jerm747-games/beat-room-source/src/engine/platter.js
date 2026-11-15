// "Put this on the turntable" from anywhere (the Sample bin, a bounce). The turntable listens.
const subs = new Set();
export const onPlatter = (fn) => (subs.add(fn), () => subs.delete(fn));
export const putOnPlatter = (clipId) => subs.forEach((fn) => fn(clipId));
