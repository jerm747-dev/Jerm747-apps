// Shared by the garage, circuit selector, and race.
window.GPDirt = (() => {
  // Rides that start on dirt. Every ride can still pick a dirt circuit from the Dirt tab;
  // the V.I.P. GT and the S.S. 55 sleeper start on the road.
  const rides = new Set(['brb', 'pto', 'wipsm']);
  const tracks = [
    {id: 'test_dirt', base: 'test', name: '747 Clay Short', short: '747 CLAY', scale: 0.56, length: 2091, elevation: 20, width: 11, color: '#a06139'},
    {id: 'coatl_dirt', base: 'coatl_canyon', name: 'Coatl Canyon Reverse', short: 'COATL DIRT', scale: 0.84, length: 2918, elevation: 56, reverse: true, width: 12, color: '#ad7748'},
    {id: 'piedmont_dirt', base: 'vir', name: 'Piedmont Red Clay', short: 'PIEDMONT CLAY', scale: 0.64, length: 3468, elevation: 21, width: 11, color: '#984f32'}
  ];
  const ids = new Set(tracks.map(track => track.id));
  const isDirt = id => ids.has(id);
  const eligible = car => rides.has(car);
  const allowed = () => true;
  const fallback = car => eligible(car) ? tracks[0].id : 'test';
  const resolve = (car, id) => id || fallback(car);
  // Picking a different ride starts it on its own home surface; the same ride keeps its circuit.
  const onRideChange = (car, previous, track) => {
    if (car === previous && track) return track;
    if (eligible(car)) return isDirt(track) ? track : tracks[0].id;
    return isDirt(track) || !track ? 'test' : track;
  };
  // Keep the start line fixed when reversing the course.
  const orient = (points, reverse) => reverse ? [points[0], ...points.slice(1).reverse()] : points;
  return {tracks, isDirt, eligible, allowed, resolve, onRideChange, orient};
})();
