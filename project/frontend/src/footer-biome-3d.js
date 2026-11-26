import * as THREE from 'three';

let activeBiome;

export function mountFooterBiome(footer) {
  activeBiome?.dispose();
  const host = footer?.querySelector('[data-footer-biome]');
  if (!host || !window.WebGLRenderingContext || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'footer-biome-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
  camera.position.set(0, .2, 11.5);
  const field = new THREE.Group();
  scene.add(field);

  // Curved, asymmetric leaf geometry makes this a botanical field rather than
  // another collection of circles, squares, or generic geometric ornaments.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(.18, .48, .53, .78, .18, 1.55);
  leafShape.bezierCurveTo(-.42, .98, -.34, .37, 0, 0);
  const leafGeometry = new THREE.ExtrudeGeometry(leafShape, { depth: .018, bevelEnabled: true, bevelThickness: .012, bevelSize: .008, bevelSegments: 2, curveSegments: 12 });
  leafGeometry.center();
  const palette = ['#84b967', '#b9d77a', '#4e8b61', '#d4e799', '#5a9d6a'];
  for (let index = 0; index < 48; index += 1) {
    const seed = Math.sin(index * 91.731) * 43758.5453;
    const random = seed - Math.floor(seed);
    const leaf = new THREE.Mesh(leafGeometry, new THREE.MeshStandardMaterial({ color: palette[index % palette.length], roughness: .68, metalness: .02, transparent: true, opacity: .76 }));
    leaf.position.set((random - .5) * 18, -3.2 + ((index * .618) % 1) * 1.55, -1.8 - ((index * .317) % 1) * 3.2);
    leaf.rotation.set(.2 + random * .65, random * 5.8, (random - .5) * 1.8);
    const scale = .38 + ((index * .73) % 1) * .72;
    leaf.scale.set(scale, scale * (1.1 + random), scale);
    leaf.userData = { phase: random * Math.PI * 2, baseY: leaf.position.y, speed: .35 + random * .36 };
    field.add(leaf);
  }
  scene.add(new THREE.HemisphereLight('#dff5bf', '#03291d', 2.4));
  const key = new THREE.DirectionalLight('#efffbc', 2.2);
  key.position.set(-3, 6, 5);
  scene.add(key);

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  let frame;
  const render = (time) => {
    field.children.forEach((leaf) => {
      const { phase, baseY, speed } = leaf.userData;
      leaf.rotation.z += Math.sin(time * .0004 + phase) * .00025;
      leaf.position.y = baseY + Math.sin(time * .00055 * speed + phase) * .11;
    });
    field.rotation.y = Math.sin(time * .00008) * .08;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);
  activeBiome = { dispose: () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); renderer.dispose(); host.replaceChildren(); } };
}
