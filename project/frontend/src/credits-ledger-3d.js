import * as THREE from 'three';

let activeLedger;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function mountCreditsLedger(section) {
  activeLedger?.dispose();
  const host = section?.querySelector('[data-credits-ledger]');
  if (!host || !window.WebGLRenderingContext) return;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.className = 'credits-ledger-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'A three-dimensional carbon accountability ledger with reduction signals orbiting it.');
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 100);
  camera.position.set(0, .15, 7.4);
  const root = new THREE.Group();
  scene.add(root);

  // A spherical accountability object keeps the 3D system organic and avoids
  // the hard square boundary of the previous ledger tile.
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1.82, 64, 64),
    new THREE.MeshPhysicalMaterial({
      color: '#73bd78', roughness: .2, metalness: .08, transmission: .12,
      thickness: .9, transparent: true, opacity: .96, clearcoat: .75,
      clearcoatRoughness: .2,
    }),
  );
  globe.rotation.set(-.1, -.26, .04);
  root.add(globe);

  // A faint faceted shell catches light like recycled glass without adding
  // heavy geometry or the obvious latitude/longitude lines of a basic globe.
  const facets = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.875, 4),
    new THREE.MeshBasicMaterial({ color: '#d8ffc3', transparent: true, opacity: .075, wireframe: true }),
  );
  facets.rotation.set(.23, -.38, .12);
  root.add(facets);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.95, 48, 48),
    new THREE.MeshBasicMaterial({ color: '#bff5aa', transparent: true, opacity: .075, side: THREE.BackSide }),
  );
  root.add(atmosphere);

  // Deterministic source-linked data points form an organic continent-like
  // pattern on the sphere. These provide visual specificity without textures.
  const pointCount = 430;
  const pointPositions = new Float32Array(pointCount * 3);
  const pointColors = new Float32Array(pointCount * 3);
  const bright = new THREE.Color('#eaffad');
  const moss = new THREE.Color('#3d8b5c');
  for (let index = 0; index < pointCount; index += 1) {
    const seed = Math.sin(index * 77.131) * 43758.5453;
    const random = seed - Math.floor(seed);
    const band = Math.sin(index * .271) * .34;
    const phi = (random * Math.PI * 2) + band;
    const theta = .45 + ((index * .61803398875) % 1) * 2.25;
    const radius = 1.852;
    pointPositions[index * 3] = radius * Math.sin(theta) * Math.cos(phi);
    pointPositions[index * 3 + 1] = radius * Math.cos(theta);
    pointPositions[index * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);
    const tone = .2 + random * .8;
    pointColors[index * 3] = moss.r + (bright.r - moss.r) * tone;
    pointColors[index * 3 + 1] = moss.g + (bright.g - moss.g) * tone;
    pointColors[index * 3 + 2] = moss.b + (bright.b - moss.b) * tone;
  }
  const dataPointsGeometry = new THREE.BufferGeometry();
  dataPointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
  dataPointsGeometry.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  const dataPoints = new THREE.Points(dataPointsGeometry, new THREE.PointsMaterial({ vertexColors: true, size: .026, transparent: true, opacity: .56, depthWrite: false }));
  root.add(dataPoints);

  const signalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.99, .025, 8, 128),
    new THREE.MeshBasicMaterial({ color: '#d9fb92', transparent: true, opacity: .76 }),
  );
  signalRing.rotation.set(1.18, -.2, -.28);
  root.add(signalRing);

  const rings = new THREE.Group();
  [2.38, 2.82, 3.28].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, .012, 6, 96),
      new THREE.MeshBasicMaterial({ color: index === 1 ? '#4f9667' : '#79ae72', transparent: true, opacity: .52 }),
    );
    ring.rotation.set(index === 0 ? .48 : 1.1, index === 1 ? -.5 : .22, index * .44);
    rings.add(ring);
  });
  root.add(rings);

  const markers = new THREE.Group();
  [[2.66, .82, '#e7f79a'], [-2.52, -1.18, '#7fc878'], [.98, -2.62, '#e4cf7b']].forEach(([x, y, color], index) => {
    const marker = new THREE.Mesh(new THREE.IcosahedronGeometry(index === 0 ? .15 : .105, 1), new THREE.MeshBasicMaterial({ color }));
    marker.position.set(x, y, .48);
    markers.add(marker);
  });
  root.add(markers);

  const ambient = new THREE.HemisphereLight('#efffe2', '#0a432d', 3.1);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#fff6bd', 4.2);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8cf0a1', 2.4);
  rim.position.set(4, -2, -4);
  scene.add(rim);

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let frame;
  const tick = (time) => {
    const rect = section.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
    const float = reducedMotion() ? 0 : Math.sin(time * .0007) * .05;
    root.rotation.y = -.16 + progress * .54 + float;
    root.rotation.x = -.04 + progress * .09;
    root.position.y = float * 2 + (1 - progress) * .14;
    rings.rotation.z = time * .000075 + progress * .75;
    signalRing.rotation.z = -.28 + time * .00018;
    facets.rotation.y = -.38 + time * .000035;
    dataPoints.rotation.y = time * .000055;
    markers.rotation.z = -time * .00012;
    markers.children.forEach((marker, index) => { marker.position.z = .48 + Math.sin(time * .0014 + index * 2.4) * .18; });
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  activeLedger = { dispose: () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); host.replaceChildren(); } };
}
