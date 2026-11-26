import { animate, inView, stagger } from 'motion';

let cleanups = [];

export function enhanceMotion(root) {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  if (!root || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const intro = root.querySelectorAll('.page-head, .carbon-hero-copy > *, .carbon-hero-visual');
  if (intro.length) {
    const controls = animate(intro, { opacity: [0, 1], y: [20, 0] }, { duration: 0.56, delay: stagger(0.07), easing: [0.16, 1, 0.3, 1] });
    cleanups.push(() => controls.stop());
  }

  root.querySelectorAll('.surface-card, .overview-stat, .pricing-card, .workflow-new-item, .carbon-stat-grid article').forEach((element) => {
    element.style.opacity = '0';
    cleanups.push(inView(element, () => animate(element, { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] }, { duration: 0.45, easing: [0.16, 1, 0.3, 1] }), { amount: 0.15 }));
  });
}
