import * as THREE from 'three';

let activeScene;
let activeForestScene;

const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function disposeScene() {
  if (!activeScene) return;
  activeScene.dispose();
  activeScene = undefined;
}

export function mountThreePlanet(host, { paused = false, variant = 'hero' } = {}) {
  disposeScene();
  if (!host || !window.WebGLRenderingContext) return;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = variant === 'dashboard' ? 1.15 : 1.08;
  renderer.domElement.className = 'three-planet-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Animated three-dimensional Earth with continents, oceans, clouds, and carbon-data orbit lines.');
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  // A closer hero lens gives the Earth real product-hero presence. Dashboard
  // stays slightly wider so its surrounding operational figures remain clear.
  camera.position.set(0, 0.05, variant === 'dashboard' ? 5.25 : 7.05);

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
    new THREE.SphereGeometry(variant === 'dashboard' ? 1.65 : 1.5, 56, 56),
    new THREE.MeshPhongMaterial({
      map: dayMap,
      normalMap,
      normalScale: new THREE.Vector2(0.72, 0.72),
      specularMap,
      // The public hero uses the texture's real earth tones. A colour tint
      // made the image look muddy against the sage page background.
      color: new THREE.Color('#ffffff'),
      specular: new THREE.Color('#a8c4d0'),
      shininess: 14,
      emissive: new THREE.Color('#081411'),
      emissiveIntensity: 0.035,
    }),
  );
  planet.add(sphere);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(variant === 'dashboard' ? 1.682 : 1.528, 56, 56),
    new THREE.MeshPhongMaterial({ map: cloudMap, transparent: true, opacity: variant === 'dashboard' ? 0.42 : 0.3, depthWrite: false, side: THREE.DoubleSide }),
  );
  planet.add(clouds);

  const rings = new THREE.Group();
  scene.add(rings);
  const ringSpecs = variant === 'dashboard' ? [
    [2.3, 1.02, 0.35, '#8ee6a3'],
    [2.56, 0.72, -0.52, '#7ec8b0'],
    [2.08, 1.22, 0.85, '#b9f6c5'],
  ] : [
    // Layered forest and mint greens keep the orbit language native to Atmos,
    // while the natural Earth texture remains deliberately untinted.
    [2.04, .72, .32, '#4b895d', .018, -.42],
    [2.22, .82, -.48, '#bde29c', -.014, .36],
    [1.9, .9, .64, '#75ae73', .011, -.18],
  ];
  ringSpecs.forEach(([x, y, rotation, color, spin = 0, tiltZ = 0]) => {
    const orbit = new THREE.Group();
    orbit.rotation.x = rotation;
    orbit.rotation.z = tiltZ;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(x, variant === 'dashboard' ? 0.011 : 0.014, 8, 128),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: variant === 'dashboard' ? 0.26 : 0.52, depthWrite: false }),
    );
    ring.scale.y = y;
    ring.userData.spin = spin;
    orbit.add(ring);
    if (variant !== 'dashboard') {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(.035, 12, 12),
        new THREE.MeshBasicMaterial({ color: '#d5f3ad', transparent: true, opacity: .92 }),
      );
      marker.position.set(x, 0, 0);
      marker.userData.radius = x;
      marker.userData.radiusY = y;
      marker.userData.phase = rotation * 1.9;
      marker.userData.speed = Math.abs(spin) * 2.9;
      orbit.add(marker);
      orbit.userData.marker = marker;
    }
    rings.add(orbit);
  });

  // Dense signal geometry belongs in the operational dashboard. The public hero
  // stays deliberately quiet so the Earth reads as one polished visual object.
  const routes = new THREE.Group();
  const routeMaterial = new THREE.MeshBasicMaterial({ color: '#c2e2ad', transparent: true, opacity: .3 });
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: '#d7f1bf', transparent: true, opacity: .72 });
  const routeSpecs = variant === 'dashboard' ? [
    [[-1.18, .34, 1.18], [-.28, 1.82, .48], [1.26, -.15, 1.05]],
    [[-1.42, -.67, .79], [.05, -1.72, 1.05], [1.43, .64, .64]],
    [[-.72, 1.36, .79], [1.68, 1.02, .12], [1.12, -.82, 1.21]],
  ] : [];
  routeSpecs.forEach((route, index) => {
    const curve = new THREE.CatmullRomCurve3(route.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const path = new THREE.Mesh(new THREE.TubeGeometry(curve, 44, .012, 5, false), routeMaterial.clone());
    path.material.opacity = .16 + index * .06;
    routes.add(path);
    const destination = route.at(-1);
    const node = new THREE.Mesh(new THREE.SphereGeometry(.052, 12, 12), nodeMaterial);
    node.position.set(...destination);
    routes.add(node);
  });
  scene.add(routes);

  const latitudeLines = new THREE.Group();
  (variant === 'dashboard' ? [-.85, -.42, 0, .42, .85] : []).forEach((y, index) => {
    const radius = Math.sqrt(1 - y * y) * 1.675;
    const line = new THREE.Mesh(
      new THREE.TorusGeometry(radius, .006, 4, 72),
       new THREE.MeshBasicMaterial({ color: '#b9d9b8', transparent: true, opacity: index === 2 ? .18 : .09 }),
    );
    line.rotation.x = Math.PI / 2;
    line.position.y = y * 1.65;
    latitudeLines.add(line);
  });
  scene.add(latitudeLines);

  const pointsGeometry = new THREE.BufferGeometry();
  const particles = new Float32Array((variant === 'dashboard' ? 180 : 0) * 3);
  for (let index = 0; index < particles.length; index += 3) {
    const radius = 2.2 + Math.random() * 1.1;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particles[index] = radius * Math.sin(phi) * Math.cos(theta);
    particles[index + 1] = radius * Math.cos(phi);
    particles[index + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
   const points = new THREE.Points(pointsGeometry, new THREE.PointsMaterial({ color: '#c7e7bf', size: 0.024, transparent: true, opacity: 0.42 }));
  scene.add(points);

  scene.add(new THREE.HemisphereLight('#edf4fa', '#06130f', variant === 'dashboard' ? 2.05 : 1.9));
  const keyLight = new THREE.DirectionalLight('#fff5df', variant === 'dashboard' ? 2.7 : 2.45);
  keyLight.position.set(-3, 3, 4);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight('#8fc5dd', variant === 'dashboard' ? 5.2 : 3.8, 12);
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
      if (variant === 'dashboard') rings.rotation.z += delta * 0.095;
      rings.children.forEach((orbit) => {
        // The plane is fixed. Ring movement happens within that plane, so the
        // orbits remain disciplined ellipses instead of tumbling across Earth.
        orbit.children[0].rotation.z += delta * orbit.children[0].userData.spin;
        const marker = orbit.userData.marker;
        if (marker) {
          marker.userData.phase += delta * marker.userData.speed;
          marker.position.set(
            Math.cos(marker.userData.phase) * marker.userData.radius,
            Math.sin(marker.userData.phase) * marker.userData.radius * marker.userData.radiusY,
            0,
          );
        }
      });
      routes.rotation.y += delta * 0.052;
      latitudeLines.rotation.y -= delta * 0.026;
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
  activeForestScene?.();
  activeForestScene = undefined;
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
  const foliage = ['#193f4d', '#245b62', '#356f72'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: false }));
  [[-1.7,.1,.92,0],[-1.2,-.55,.63,1],[-.72,.28,.73,2],[-.25,-.26,1.12,1],[.3,.28,.76,0],[.76,-.45,.88,2],[1.3,.08,.7,1],[1.78,-.23,.98,0],[.16,.83,.52,2]].forEach(([x,z,scale,index]) => {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, .82, 7), trunkMaterial);
    trunk.position.y = .41;
    tree.add(trunk);
    const lower = new THREE.Mesh(new THREE.IcosahedronGeometry(.48, 2), foliage[index]);
    lower.position.y = .84;
    lower.scale.set(1.1, .9, 1);
    const upper = new THREE.Mesh(new THREE.IcosahedronGeometry(.38, 2), foliage[(index + 1) % foliage.length]);
    upper.position.set(.09, 1.27, -.06);
    tree.add(lower, upper);
    scene.add(tree);
  });
  let frame;
  const clock = new THREE.Clock();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const render = () => {
    if (!reducedMotion && !document.hidden) {
      const time = clock.getElapsedTime();
      scene.rotation.y = Math.sin(time * .09) * .025;
      scene.position.y = Math.sin(time * .18) * .035;
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  render();
  activeForestScene = () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); host.replaceChildren(); };
}
