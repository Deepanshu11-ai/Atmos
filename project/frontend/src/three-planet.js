import * as THREE from 'three';

let activeScene;

const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function disposeScene() {
  if (!activeScene) return;
  activeScene.dispose();
  activeScene = undefined;
}

export function mountThreePlanet(host, { paused = false } = {}) {
  disposeScene();
  if (!host || !window.WebGLRenderingContext) return;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.domElement.className = 'three-planet-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Animated three-dimensional Earth with continents, oceans, clouds, and carbon-data orbit lines.');
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.05, 6.1);

  const planet = new THREE.Group();
  scene.add(planet);
  const textureLoader = new THREE.TextureLoader();
  const dayMap = textureLoader.load('/textures/earth-day.jpg');
  const normalMap = textureLoader.load('/textures/earth-normal.jpg');
  const specularMap = textureLoader.load('/textures/earth-specular.jpg');
  const cloudMap = textureLoader.load('/textures/earth-clouds.png');
  [dayMap, normalMap, specularMap, cloudMap].forEach((texture) => {
    texture.colorSpace = texture === dayMap || texture === cloudMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 56, 56),
    new THREE.MeshPhongMaterial({
      map: dayMap,
      normalMap,
      normalScale: new THREE.Vector2(0.72, 0.72),
      specularMap,
      specular: new THREE.Color('#7db9d8'),
      shininess: 16,
      emissive: new THREE.Color('#071f1c'),
      emissiveIntensity: 0.16,
    }),
  );
  planet.add(sphere);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.682, 56, 56),
    new THREE.MeshPhongMaterial({ map: cloudMap, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }),
  );
  planet.add(clouds);

  const rings = new THREE.Group();
  scene.add(rings);
  [
    [2.3, 1.02, 0.35, '#8ee6a3'],
    [2.56, 0.72, -0.52, '#7ec8b0'],
    [2.08, 1.22, 0.85, '#b9f6c5'],
  ].forEach(([x, y, rotation, color]) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(x, 0.011, 6, 96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.48 }),
    );
    ring.scale.y = y;
    ring.rotation.x = rotation;
    rings.add(ring);
  });

  const pointsGeometry = new THREE.BufferGeometry();
  const particles = new Float32Array(180 * 3);
  for (let index = 0; index < particles.length; index += 3) {
    const radius = 2.2 + Math.random() * 1.1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particles[index] = radius * Math.sin(phi) * Math.cos(theta);
    particles[index + 1] = radius * Math.cos(phi);
    particles[index + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
  const points = new THREE.Points(pointsGeometry, new THREE.PointsMaterial({ color: '#baf8c2', size: 0.028, transparent: true, opacity: 0.72 }));
  scene.add(points);

  scene.add(new THREE.HemisphereLight('#b9dbff', '#031a17', 1.8));
  const keyLight = new THREE.DirectionalLight('#fff5dc', 3.1);
  keyLight.position.set(-3, 3, 4);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight('#6e9ed8', 5, 12);
  rimLight.position.set(2.4, -1.5, 2.8);
  scene.add(rimLight);

  let targetX = 0;
  let targetY = 0;
  let reducedMotion = reduceMotionQuery?.matches ?? false;
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const onPointerMove = (event) => {
    const bounds = host.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.65;
    targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.35;
  };
  const onPointerLeave = () => { targetX = 0; targetY = 0; };
  const onMotionPreference = (event) => { reducedMotion = event.matches; };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerleave', onPointerLeave);
  reduceMotionQuery?.addEventListener('change', onMotionPreference);
  resize();
  host.classList.add('is-ready');

  const clock = new THREE.Clock();
  let frame;
  const render = () => {
    const delta = Math.min(clock.getDelta(), 0.05);
    const shouldMove = !paused && !reducedMotion && !document.hidden;
    if (shouldMove) {
      planet.rotation.y += delta * 0.18;
      clouds.rotation.y += delta * 0.022;
      rings.rotation.z += delta * 0.095;
      points.rotation.y -= delta * 0.025;
      planet.rotation.x += (targetY - planet.rotation.x) * 0.045;
      planet.rotation.z += (targetX - planet.rotation.z) * 0.045;
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  render();

  activeScene = {
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      reduceMotionQuery?.removeEventListener('change', onMotionPreference);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => material.dispose?.());
      });
      renderer.dispose();
      [dayMap, normalMap, specularMap, cloudMap].forEach((texture) => texture.dispose());
      host.replaceChildren();
    },
  };
}

export function mountForestScene(host) {
  if (!host || !window.WebGLRenderingContext) return;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.domElement.className = 'three-forest-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'A still three-dimensional forest landscape representing measurable climate action.');
  host.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.35, 6.3);
  camera.lookAt(0, 0.58, 0);
  scene.add(new THREE.HemisphereLight('#e8ffe3', '#173722', 2.2));
  const sunlight = new THREE.DirectionalLight('#fff6d5', 2.6);
  sunlight.position.set(-3, 5, 4);
  scene.add(sunlight);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3.25, 56), new THREE.MeshStandardMaterial({ color: '#315c37', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#5a3722', roughness: 1 });
  const foliage = ['#1f5737', '#317c48', '#4b9857'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .95 }));
  [[-1.7,.1,.92,0],[-1.2,-.55,.63,1],[-.72,.28,.73,2],[-.25,-.26,1.12,1],[.3,.28,.76,0],[.76,-.45,.88,2],[1.3,.08,.7,1],[1.78,-.23,.98,0],[.16,.83,.52,2]].forEach(([x,z,scale,index]) => {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, .82, 7), trunkMaterial);
    trunk.position.y = .41;
    tree.add(trunk);
    const lower = new THREE.Mesh(new THREE.ConeGeometry(.43, .86, 8), foliage[index]);
    lower.position.y = .72;
    const upper = new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 8), foliage[(index + 1) % foliage.length]);
    upper.position.y = 1.15;
    tree.add(lower, upper);
    scene.add(tree);
  });
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
}
