/* Prepare the unoccupied podium editions in source-model coordinates. */
window.GPFinishParkCar = function (T, car, vehicle) {
  const cut = window.GPFinishCockpitMasks[vehicle];
  if (!cut) return;
  const geometry = car.geometry;
  const original = geometry.index.array;
  if (original.length !== cut.faces * 3) throw new Error('Podium vehicle mesh differs from 1.2.16');
  const removed = atob(cut.bits);
  const kept = new original.constructor(original.length - cut.removed * 3);
  let offset = 0;
  for (let face = 0; face < cut.faces; face++) {
    if (removed.charCodeAt(face >> 3) & (1 << (face & 7))) continue;
    const i = face * 3;
    kept[offset++] = original[i];
    kept[offset++] = original[i + 1];
    kept[offset++] = original[i + 2];
  }
  geometry.setIndex(new T.BufferAttribute(kept, 1));
  const shell = new T.MeshStandardMaterial({color:0x26292b, roughness:.9, metalness:.04, side:T.DoubleSide});
  function bucket(rows, material) {
    const positions = [], indices = [];
    const sections = [-1, -.86, -.64, -.32, 0, .32, .64, .86, 1];
    for (const [z, y, width, lip, sweep] of rows) {
      for (const side of sections) {
        const edge = side ** 4;
        positions.push(side * width, y + edge * lip, z + edge * sweep);
      }
    }
    const step = sections.length;
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < step - 1; j++) {
        const a = i * step + j;
        indices.push(a, a + step, a + 1, a + 1, a + step, a + step + 1);
      }
    }
    const surface = new T.BufferGeometry();
    surface.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    car.add(new T.Mesh(surface, material));
  }
  if (vehicle === 'f1') {
    bucket([[-.269,.837,.114,.004,.018],[-.245,.79,.119,.008,.023],[-.174,.731,.12,.028,.016],[-.095,.714,.12,.03,.006],[.012,.695,.115,.023,0],[.093,.687,.10,.012,0]], shell);
    return;
  }

  const alloy = new T.MeshStandardMaterial({color:0x585b5b, roughness:.53, metalness:.55, side:T.DoubleSide});
  bucket([[-.37,.052,.18,.005,0],[.13,.051,.203,.01,0],[.50,.057,.18,.008,0]], alloy);
  bucket([[-.574,.437,.148,.006,.028],[-.552,.420,.165,.012,.041],[-.50,.335,.18,.021,.06],[-.437,.206,.177,.043,.047],[-.35,.119,.173,.057,.027],[-.246,.103,.170,.045,.008],[-.147,.117,.157,.027,0],[-.103,.135,.139,.016,0]], shell);

  // The original gloves and steering grip shared faces. Fit a complete rim to the column.
  const hub = new T.Vector3(0,.546,.104);
  function tube(points, radius, material, closed = false) {
    const curve = new T.CatmullRomCurve3(points, closed);
    const shape = new T.TubeGeometry(curve, closed ? 56 : 8, radius, 8, closed);
    car.add(new T.Mesh(shape, material));
  }
  const ring = [];
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16;
    ring.push(new T.Vector3(.18 * Math.cos(a), hub.y + .077 * Math.sin(a), hub.z + .092 * Math.sin(a)));
  }
  tube(ring, .014, shell, true);
  for (const index of [0, 16, 24]) tube([hub, ring[index]], .009, alloy);
  tube([hub, new T.Vector3(0,.398,.215)], .012, alloy);
};
