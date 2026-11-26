import { animate, inView, stagger } from 'motion';

let cleanups = [];

export function enhanceMotion(root) {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  if (!root || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const intro = root.querySelectorAll('.page-head, .carbon-hero-copy > *, .carbon-hero-visual, .carbon-dashboard-hero > *');
  if (intro.length) {
    const controls = animate(intro, { opacity: [0, 1], y: [20, 0] }, { duration: 0.56, delay: stagger(0.07), easing: [0.16, 1, 0.3, 1] });
    cleanups.push(() => controls.stop());
  }

  root.querySelectorAll('.surface-card, .overview-stat, .pricing-card, .carbon-stat-grid article').forEach((element) => {
    element.style.opacity = '0';
    cleanups.push(inView(element, () => animate(element, { opacity: [0, 1], y: [18, 0], scale: [0.985, 1] }, { duration: 0.45, easing: [0.16, 1, 0.3, 1] }), { amount: 0.15 }));
  });

  root.querySelectorAll('.carbon-signal-strip article, .carbon-stat-grid article').forEach((element) => {
    const cleanup = inView(element, () => animate(element, { rotateX: [3, 0], y: [26, 0] }, { duration: .72, easing: [0.16, 1, .3, 1] }), { amount: .18 });
    cleanups.push(cleanup);
  });

  // The four workflow cards are treated as objects entering the system: they
  // drop, settle, then hold their exact grid position. This is intentionally
  // tied to the grid entering the viewport rather than an arbitrary timer.
  const workflowGrid = root.querySelector('.workflow-new-grid');
  const workflowHeading = root.querySelector('.workflow-new-heading');
  if (workflowHeading) {
    const kicker = workflowHeading.querySelector('.carbon-kicker');
    const title = workflowHeading.querySelector('h2');
    const copy = workflowHeading.querySelector('p');
    const headingParts = [kicker, title, copy].filter(Boolean);
    headingParts.forEach((element) => {
      element.style.opacity = '0';
      element.style.willChange = 'transform, opacity, filter';
    });
    const cleanup = inView(workflowHeading, () => {
      const animations = [];
      if (kicker) animations.push(animate(kicker, { opacity: [0, 1], x: [-26, 0] }, { duration: .38, easing: [0.16, 1, .3, 1] }));
      if (title) animations.push(animate(title, { opacity: [0, 1], y: [42, 0], filter: ['blur(9px)', 'blur(0px)'] }, { duration: .76, delay: .09, easing: [0.16, 1, .3, 1] }));
      if (copy) animations.push(animate(copy, { opacity: [0, 1], x: [34, 0] }, { duration: .55, delay: .27, easing: [0.16, 1, .3, 1] }));
      return () => {
        animations.forEach((animation) => animation.stop());
        if (kicker) Object.assign(kicker.style, { opacity: '0', transform: 'translateX(-26px)' });
        if (title) Object.assign(title.style, { opacity: '0', transform: 'translateY(42px)', filter: 'blur(9px)' });
        if (copy) Object.assign(copy.style, { opacity: '0', transform: 'translateX(34px)' });
      };
    }, { amount: .42 });
    cleanups.push(cleanup);
  }
  if (workflowGrid) {
    const cards = [...workflowGrid.querySelectorAll('.workflow-new-item')];
    cards.forEach((card) => {
      card.style.opacity = '0';
      card.style.willChange = 'transform, opacity';
    });
    const cleanup = inView(workflowGrid, () => {
      cards.forEach((card, index) => {
        const direction = index % 2 ? 1 : -1;
        const controls = animate(
          card,
          { opacity: [0, 1, 1], y: [-260, 15, 0], rotate: [direction * 4, direction * -1.2, 0], scale: [.94, 1.012, 1] },
          { duration: .98, delay: index * .13, easing: [.16, 1, .3, 1], times: [0, .78, 1] },
        );
        cleanups.push(() => controls.stop());
      });
      // Return an exit handler: every later scroll back into the section starts
      // the cards above their final position again, ready for another landing.
      return () => {
        cards.forEach((card, index) => {
          const direction = index % 2 ? 1 : -1;
          Object.assign(card.style, { opacity: '0', transform: `translateY(-260px) rotate(${direction * 4}deg) scale(.94)` });
        });
      };
    }, { amount: .24 });
    cleanups.push(cleanup);
  }

  // Keep the carbon-accounting section composited as separate visible pieces.
  // Animating the section wrapper can leave its CTA visually detached while
  // the wrapper is hidden by a legacy scroll-reveal rule.
  const credits = root.querySelector('.carbon-credits-section');
  if (credits) {
    const editorial = credits.querySelector('.credits-editorial');
    const visual = credits.querySelector('.credits-visual-panel');
    // The legacy CSS bundle applies reveal transforms in several places. Keep
    // this conversion-critical content rendered in its final layout state;
    // its orbit, glow, and mini cards retain their own non-layout animation.
    [editorial, visual].filter(Boolean).forEach((element) => {
      Object.assign(element.style, { opacity: '1', transform: 'none', filter: 'none', visibility: 'visible' });
    });
  }

  root.querySelectorAll('.carbon-hero-visual, .carbon-dashboard-hero').forEach((element) => {
    const pointerMove = (event) => {
      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      element.style.setProperty('--parallax-x', `${(x * 10).toFixed(2)}px`);
      element.style.setProperty('--parallax-y', `${(y * 8).toFixed(2)}px`);
    };
    const pointerLeave = () => { element.style.setProperty('--parallax-x', '0px'); element.style.setProperty('--parallax-y', '0px'); };
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerleave', pointerLeave);
    cleanups.push(() => { element.removeEventListener('pointermove', pointerMove); element.removeEventListener('pointerleave', pointerLeave); });
  });
}
