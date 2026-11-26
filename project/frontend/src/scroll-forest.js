import * as THREE from 'three';

let activeForest;

const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function seeded(index) {
  const value = Math.sin(index * 989.71) * 43758.5453;
  return value - Math.floor(value);
}

export function mountScrollForest(section) {
  activeForest?.dispose();
  if (!section || !window.WebGLRenderingContext) return;

  const host = section.querySelector('[data-forest-canvas]');
  const readout = section.querySelector('[data-forest-readout]');
  const features = [...section.querySelectorAll('[data-forest-feature]')];
  if (!host) return;

  const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.className = 'scroll-forest-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'A three-dimensional forest that moves forward as you scroll through Atmos climate intelligence.');
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a2927');
  scene.fog = new THREE.FogExp2('#0a2927', .043);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 120);
  const target = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const skyDirection = new THREE.Vector3();
  const skyRight = new THREE.Vector3();
  const skyUp = new THREE.Vector3();

  const skyLight = new THREE.HemisphereLight('#d9f4ff', '#173b2a', 3.15);
  scene.add(skyLight);
  const sun = new THREE.DirectionalLight('#eaffc4', 2.4);
  sun.position.set(-8, 12, -8);
  scene.add(sun);
  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(.92, 28, 28),
    new THREE.MeshBasicMaterial({ color: '#fff0b5', transparent: true, opacity: 1, depthWrite: false, depthTest: false }),
  );
  sunDisk.renderOrder = 20;
  scene.add(sunDisk);
  const rim = new THREE.PointLight('#71ccaa', 12, 24, 2);
  rim.position.set(3, 3, -8);
  scene.add(rim);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(.78, 28, 28),
    new THREE.MeshBasicMaterial({ color: '#dceeff', transparent: true, opacity: 0, depthWrite: false, depthTest: false }),
  );
  moon.position.set(-5.4, 7.2, -26);
  moon.visible = false;
  moon.renderOrder = 20;
  scene.add(moon);
  const moonLight = new THREE.DirectionalLight('#a8c8ff', 0);
  moonLight.position.set(-5, 8, -13);
  scene.add(moonLight);
  const starsGeometry = new THREE.BufferGeometry();
  const starsPosition = new Float32Array(460 * 3);
  for (let index = 0; index < starsPosition.length; index += 3) {
    const seed = index / 3;
    starsPosition[index] = (seeded(seed + 1201) - .5) * 38;
    starsPosition[index + 1] = 3 + seeded(seed + 1301) * 17;
    starsPosition[index + 2] = -25 - seeded(seed + 1401) * 63;
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPosition, 3));
  const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: '#d9eaff', size: .038, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
  stars.renderOrder = 18;
  scene.add(stars);

  const groundMaterial = new THREE.MeshStandardMaterial({ color: '#123c35', roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(45, 155, 16, 42),
    groundMaterial,
  );
  ground.rotation.x = -Math.PI / 2;
  for (let index = 0; index < ground.geometry.attributes.position.count; index += 1) {
    const x = ground.geometry.attributes.position.getX(index);
    const z = ground.geometry.attributes.position.getY(index);
    ground.geometry.attributes.position.setZ(index, Math.sin(x * .7 + z * .12) * .1 + Math.cos(z * .32) * .07);
  }
  ground.geometry.computeVertexNormals();
  scene.add(ground);

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#382d20', roughness: 1, flatShading: true });
  const branchMaterial = new THREE.MeshStandardMaterial({ color: '#483525', roughness: 1, flatShading: true });
  const foliageMaterials = ['#183d50', '#24586a', '#397b80', '#72a8a4'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .87, flatShading: false, transparent: true }));
  const trunkGeometry = new THREE.CylinderGeometry(.13, .22, 3.7, 8);
  const branchGeometry = new THREE.CylinderGeometry(.035, .075, 1.12, 6);
  const foliageGeometry = new THREE.IcosahedronGeometry(.7, 2);
  const makeTree = (seed) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.85;
    tree.add(trunk);
    // Individual limbs and overlapping irregular foliage clusters make a deciduous
    // woodland silhouette instead of the previous low-poly cone-tree icon.
    for (let limb = 0; limb < 6; limb += 1) {
      const angle = seeded(seed * 11 + limb) * Math.PI * 2;
      const height = 1.65 + seeded(seed * 17 + limb) * 1.7;
      const branch = new THREE.Mesh(branchGeometry, branchMaterial);
      branch.position.set(Math.cos(angle) * .34, height, Math.sin(angle) * .34);
      branch.rotation.set(Math.sin(angle) * .45, 0, -Math.cos(angle) * .92);
      tree.add(branch);
      for (let clump = 0; clump < 3; clump += 1) {
        const distance = .55 + clump * .26;
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterials[(limb + clump + Math.floor(seed * 7)) % foliageMaterials.length]);
        foliage.position.set(Math.cos(angle) * distance + (seeded(seed + limb * 8 + clump) - .5) * .35, height + .3 + clump * .23, Math.sin(angle) * distance + (seeded(seed + limb * 13 + clump) - .5) * .35);
        foliage.scale.set(.58 + seeded(seed + limb + clump) * .42, .65 + seeded(seed + limb * 3 + clump) * .48, .58 + seeded(seed + limb * 5 + clump) * .42);
        tree.add(foliage);
      }
    }
    const crown = new THREE.Mesh(foliageGeometry, foliageMaterials[Math.floor(seeded(seed * 19) * foliageMaterials.length)]);
    crown.position.y = 4.15;
    crown.scale.set(1.25, 1.45, 1.2);
    tree.add(crown);
    return tree;
  };

  const forest = new THREE.Group();
  for (let index = 0; index < 92; index += 1) {
    const item = makeTree(index + 1);
    const side = index % 2 ? 1 : -1;
    const depth = -2 - Math.floor(index / 2) * 1.18 - seeded(index + 4) * .7;
    const scale = .42 + seeded(index + 17) * 1.08;
    item.position.set(side * (2.7 + seeded(index + 8) * 7.2), 0, depth);
    item.rotation.y = seeded(index + 29) * Math.PI;
    item.scale.setScalar(scale);
    forest.add(item);
  }
  scene.add(forest);

  const rockGeometry = new THREE.DodecahedronGeometry(.32, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: '#4a5445', roughness: 1, flatShading: true });
  for (let index = 0; index < 85; index += 1) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    const side = index % 2 ? 1 : -1;
    rock.position.set(side * (1.7 + seeded(index + 402) * 8), .1, -seeded(index + 502) * 79);
    rock.rotation.set(seeded(index + 602), seeded(index + 702), seeded(index + 802));
    rock.scale.setScalar(.35 + seeded(index + 902) * 1.3);
    scene.add(rock);
  }

  const motePositions = new Float32Array(280 * 3);
  for (let index = 0; index < motePositions.length; index += 3) {
    const seed = index / 3;
    motePositions[index] = (seeded(seed + 101) - .5) * 19;
    motePositions[index + 1] = .3 + seeded(seed + 211) * 8;
    motePositions[index + 2] = -seeded(seed + 313) * 78;
  }
  const motesGeometry = new THREE.BufferGeometry();
  motesGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const motes = new THREE.Points(motesGeometry, new THREE.PointsMaterial({ color: '#dbffad', size: .045, transparent: true, opacity: .68, depthWrite: false }));
  scene.add(motes);

  // Spring leaves and winter snow are independent particle fields, rather than
  // recoloured versions of the same floating dust. Their trajectories and
  // sizes are deliberately different so the season change reads immediately.
  const leafCount = 170;
  const leafPositions = new Float32Array(leafCount * 3);
  const leafSeeds = new Float32Array(leafCount);
  for (let index = 0; index < leafCount; index += 1) {
    leafSeeds[index] = seeded(index + 1801);
    leafPositions[index * 3] = (seeded(index + 1901) - .5) * 21;
    leafPositions[index * 3 + 1] = seeded(index + 2001) * 10;
    leafPositions[index * 3 + 2] = -seeded(index + 2101) * 76;
  }
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.BufferAttribute(leafPositions, 3));
  const leaves = new THREE.Points(leafGeometry, new THREE.PointsMaterial({ color: '#b7e174', size: .095, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
  scene.add(leaves);

  const snowCount = 760;
  const snowPositions = new Float32Array(snowCount * 3);
  const snowSeeds = new Float32Array(snowCount);
  for (let index = 0; index < snowCount; index += 1) {
    snowSeeds[index] = seeded(index + 2201);
    snowPositions[index * 3] = (seeded(index + 2301) - .5) * 25;
    snowPositions[index * 3 + 1] = seeded(index + 2401) * 15;
    snowPositions[index * 3 + 2] = 5 - seeded(index + 2501) * 85;
  }
  const snowGeometry = new THREE.BufferGeometry();
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snow = new THREE.Points(snowGeometry, new THREE.PointsMaterial({ color: '#f1fbff', size: .072, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
  scene.add(snow);

  const seasons = [
    { name: 'SPRING / DAYLIGHT', sky: '#5f9fb0', fog: '#5f9fb0', ground: '#356b47', foliage: ['#2b724b', '#46975b', '#78b968', '#b3dc7f'], mote: '#e3ff9d', sun: '#fff2b3' },
    { name: 'SUMMER / DAYLIGHT', sky: '#34788b', fog: '#34788b', ground: '#246344', foliage: ['#1d623f', '#31824e', '#52a761', '#8bce73'], mote: '#c6ffe0', sun: '#fff7ce' },
    { name: 'AUTUMN / SUNSET', sky: '#4c3034', fog: '#4c3034', ground: '#4b3827', foliage: ['#534326', '#806132', '#b97537', '#e5a653'], mote: '#ffcf7c', sun: '#ffb76b' },
    { name: 'WINTER / MOONLIGHT', sky: '#091a35', fog: '#091a35', ground: '#263d4a', foliage: ['#294b59', '#477182', '#78a2b1', '#bedee7'], mote: '#e8f8ff', sun: '#dceeff' },
  ];
  const seasonColors = { sky: new THREE.Color(), fog: new THREE.Color(), ground: new THREE.Color(), mote: new THREE.Color(), sun: new THREE.Color() };
  const applySeason = (journey) => {
    const scaled = journey * (seasons.length - 1);
    const start = Math.floor(scaled);
    const end = Math.min(seasons.length - 1, start + 1);
    const blend = scaled - start;
    const from = seasons[start];
    const to = seasons[end];
    const lerp = (key) => seasonColors[key].set(from[key]).lerp(new THREE.Color(to[key]), blend);
    lerp('sky'); lerp('fog'); lerp('ground'); lerp('mote'); lerp('sun');
    scene.background.copy(seasonColors.sky);
    scene.fog.color.copy(seasonColors.fog);
    groundMaterial.color.copy(seasonColors.ground);
    motes.material.color.copy(seasonColors.mote);
    sun.color.copy(seasonColors.sun);
    foliageMaterials.forEach((material, index) => material.color.set(from.foliage[index]).lerp(new THREE.Color(to.foliage[index]), blend));
    motes.material.size = start === 2 ? .06 : .045;
  };
  const updateSkyCycle = (journey) => {
    // A clearly visible sky choreography: sunrise at the low left horizon,
    // noon above the canopy, sunset to the right, then moonrise at night.
    const night = clamp((journey - .72) / .28);
    const sunset = clamp((journey - .5) / .25);
    const sunFade = 1 - clamp((journey - .57) / .18);
    const solarArc = Math.sin(clamp(journey / .75) * Math.PI);
    // Place celestial bodies in camera space, not fixed world space. This
    // guarantees their arc remains inside the viewport while the camera bends
    // through the forest path.
    camera.getWorldDirection(skyDirection);
    skyRight.crossVectors(skyDirection, camera.up).normalize();
    skyUp.crossVectors(skyRight, skyDirection).normalize();
    const positionInSky = (object, horizontal, vertical, distance = 19) => {
      object.position.copy(camera.position)
        .addScaledVector(skyDirection, distance)
        .addScaledVector(skyRight, horizontal)
        .addScaledVector(skyUp, vertical);
    };
    // Start with the sun already high in a clear daytime sky, then carry it
    // through a gentle afternoon arc into sunset instead of opening at dusk.
    const sunX = 4.8 - clamp(journey / .75) * 9.8;
    const sunY = 5.7 + solarArc * 2.15 - sunset * 8.2;
    positionInSky(sunDisk, sunX, sunY);
    sun.position.copy(sunDisk.position).addScaledVector(skyDirection, 5);
    sun.intensity = 3.4 * sunFade;
    sunDisk.material.opacity = sunFade;
    rim.intensity = 8 + sunset * 4 + night * 6;
    moon.visible = night > .015;
    positionInSky(moon, 4.7 - night * 1.1, -1.8 + night * 7.2);
    moon.rotation.y += .002;
    moon.material.opacity = night;
    moon.scale.setScalar(1.15 + night * .55);
    moonLight.position.copy(moon.position).addScaledVector(skyDirection, 3);
    moonLight.intensity = night * 1.9;
    stars.material.opacity = night * .92;
    stars.rotation.y = journey * .12;
    scene.fog.density = .043 - night * .012;
    skyLight.intensity = 3.15 - night * 1.65;
    // The canopy is full in spring/summer, warms and thins through autumn,
    // then becomes visibly sparse under the moonlit winter snowfall.
    const winterCanopy = 1 - clamp((journey - .58) / .42) * .77;
    foliageMaterials.forEach((material) => { material.opacity = winterCanopy; });
    // Keep a readable sun at sunset and a readable moon at night even in a
    // dense forest, rather than letting the canopy occlude the sky cue.
    sunDisk.visible = sunFade > .01;
  };
  const updateWeather = (elapsed, journey) => {
    const spring = 1 - clamp(journey / .29);
    const winter = clamp((journey - .67) / .17);
    leaves.material.opacity = reduced ? 0 : spring * .86;
    snow.material.opacity = reduced ? 0 : winter * .94;

    if (!reduced) {
      for (let index = 0; index < leafCount; index += 1) {
        const seed = leafSeeds[index];
        const offset = (elapsed * (.48 + seed * .42) + seed * 13) % 11;
        leafPositions[index * 3] = (seed - .5) * 22 + Math.sin(elapsed * 1.15 + seed * 29) * (1.1 + seed * 1.7);
        leafPositions[index * 3 + 1] = 10.5 - offset;
        leafPositions[index * 3 + 2] = -4 - ((seed * 71 + elapsed * .38) % 72);
      }
      leafGeometry.attributes.position.needsUpdate = true;
      for (let index = 0; index < snowCount; index += 1) {
        const seed = snowSeeds[index];
        const fall = (elapsed * (.85 + seed * .48) + seed * 19) % 15;
        snowPositions[index * 3] = (seed - .5) * 26 + Math.sin(elapsed * .72 + seed * 37) * 1.25;
        snowPositions[index * 3 + 1] = 14.5 - fall;
        snowPositions[index * 3 + 2] = 4 - ((seed * 83 + elapsed * .55) % 86);
      }
      snowGeometry.attributes.position.needsUpdate = true;
    }
  };

  let width = 0;
  let height = 0;
  let reduced = prefersReducedMotion?.matches ?? false;
  let progress = 0;
  let animationFrame;
  const resize = () => {
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    width = bounds.width;
    height = bounds.height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  const updateScroll = () => {
    const bounds = section.getBoundingClientRect();
    const distance = Math.max(1, section.offsetHeight - innerHeight);
    progress = clamp(-bounds.top / distance);
    section.style.setProperty('--forest-progress', progress.toFixed(3));
    const beat = Math.min(3, Math.floor(progress * 4));
    section.style.setProperty('--forest-beat', String(beat));
    features.forEach((feature, index) => feature.classList.toggle('is-active', index === beat));
    const phase = progress < .25 ? 'SPRING / LEAF FALL' : progress < .52 ? 'SUMMER / DAYLIGHT' : progress < .72 ? 'AUTUMN / SUNSET' : 'WINTER / MOON + SNOW';
    if (readout) readout.textContent = `${String(Math.round(progress * 100)).padStart(2, '0')}% / ${phase}`;
  };
  const onMotionChange = (event) => { reduced = event.matches; };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  addEventListener('scroll', updateScroll, { passive: true });
  prefersReducedMotion?.addEventListener('change', onMotionChange);
  resize();
  updateScroll();

  const clock = new THREE.Clock();
  const render = () => {
    const elapsed = clock.getElapsedTime();
    const journey = reduced ? Math.round(progress * 3) / 3 : progress;
    camera.position.set(Math.sin(journey * Math.PI * 2.1) * 1.1, 1.55 + journey * .65, 5 - journey * 67);
    forward.set(Math.sin(journey * Math.PI * 2.1 + .21) * .45, 1.7 + journey * .52, camera.position.z - 8.8);
    target.lerp(forward, .1);
    camera.lookAt(target);
    applySeason(journey);
    updateSkyCycle(journey);
    updateWeather(elapsed, journey);
    if (!reduced && !document.hidden) {
      motes.rotation.y = elapsed * .018;
      motes.position.y = Math.sin(elapsed * (journey > .66 ? .45 : .18)) * .18;
      forest.rotation.y = Math.sin(elapsed * .13) * .006;
    }
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(render);
  };
  render();

  activeForest = {
    dispose() {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      removeEventListener('scroll', updateScroll);
      prefersReducedMotion?.removeEventListener('change', onMotionChange);
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).forEach((material) => material.dispose?.());
      });
      renderer.dispose();
      host.replaceChildren();
    },
  };
}
