import './style.css';
import { request } from './api.js';

const iconPaths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  arrowUp: '<path d="M7 17 17 7M8 7h9v9"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 14h5M3 9h18"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a6 6 0 0 1 12 0v2H3Zm14-14a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
  layers: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="12" width="18" height="8" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  spark: '<path d="m12 2 1.9 7.1L21 11l-7.1 1.9L12 20l-1.9-7.1L3 11l7.1-1.9L12 2Zm6 16 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
  shield: '<path d="M12 2 4 6v6c0 5 3.4 8.3 8 10 4.6-1.7 8-5 8-10V6l-8-4Z"/><path d="m9 12 2 2 4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 6m2 2v-6h-6"/>',
  bolt: '<path d="m13 2-9 11h7l-1 9 10-12h-7l0-8Z"/>',
  file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M5 14v6h14v-6"/>',
  download: '<path d="M12 4v12m-4-4 4 4 4-4M5 20h14"/>',
};
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const nav = [
  ['dashboard', 'Overview', 'grid'],
  ['purchase', 'Buy credits', 'wallet'],
  ['bills', 'Bills', 'file'],
  ['emissions', 'Emissions', 'bolt'],
  ['activity', 'Activity', 'clock'],
  ['team', 'Team members', 'people'],
  ['departments', 'Departments', 'layers'],
];
const app = document.querySelector('#app');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const count = (value) => Number(value ?? 0).toLocaleString();
const money = (plan) => new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency }).format(plan.price_cents / 100);
const when = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const admin = () => state.profile?.role === 'admin';
const dataOfficer = () => state.profile?.role === 'data_officer';
const complianceManager = () => state.profile?.role === 'compliance_manager';
const visibleNav = () => nav.filter(([key]) => {
  if (dataOfficer()) return key === 'bills';
  if (complianceManager() && key === 'purchase') return false;
  if (key === 'emissions') return admin() || complianceManager();
  if (key === 'bills') return admin();
  return admin() || !['team', 'departments'].includes(key);
});
const field = (label, name, type = 'text', attrs = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" ${attrs} required></label>`;
const toast = () => state.notice ? `<div class="toast ${state.notice.type}" role="${state.notice.type === 'error' ? 'alert' : 'status'}">${icon(state.notice.type === 'error' ? 'close' : 'check', 17)}<span>${esc(state.notice.text)}</span><button data-action="dismiss" aria-label="Dismiss notification">${icon('close', 16)}</button></div>` : '';

const routeFromHash = () => {
  const route = location.hash.slice(1).replace(/^\//, '').split('?')[0];
  return ['home', 'login', 'register', ...nav.map(([key]) => key)].includes(route) ? route : 'home';
};
const state = {
  route: routeFromHash(), token: sessionStorage.getItem('atmos.token') || '', profile: null,
  plans: {}, departments: [], users: [], bills: [], billsError: '', emissions: null, emissionsError: '', balance: null, transactions: [], department: '',
  busy: false, notice: null, selectedPlan: null, mobileMenu: false, loading: true,
  plansLoading: false, plansError: '',
};

const api = (path, options = {}) => request(path, { token: state.token, ...options });
async function loadPlans() {
  if (state.plansLoading) return;
  state.plansLoading = true;
  state.plansError = '';
  try {
    const plans = await api('/credits/plans', { token: '' });
    if (!plans || !Object.keys(plans).length) throw new Error('No credit packs are currently available.');
    state.plans = plans;
  } catch (error) {
    state.plansError = error.message;
  } finally {
    state.plansLoading = false;
    render();
  }
}
function clearSession() {
  state.token = '';
  sessionStorage.removeItem('atmos.token');
  state.profile = null;
  state.balance = null;
  state.departments = [];
  state.users = [];
  state.transactions = [];
  state.bills = [];
  state.billsError = '';
  state.emissions = null;
  state.emissionsError = '';
  state.department = '';
}
function navigate(route) {
  state.selectedPlan = null;
  state.mobileMenu = false;
  state.notice = null;
  state.route = route;
  if (location.hash !== `#${route}`) location.hash = route;
  render();
  window.scrollTo(0, 0);
}
async function refresh() {
  if (!state.token) return;
  const profile = await api('/users/me');
  state.profile = profile;
  if (admin()) {
    state.departments = await api('/admin/departments');
    if (!state.departments.some((department) => String(department.id) === state.department)) state.department = String(profile.department_id ?? state.departments[0]?.id ?? '');
  } else {
    state.departments = [];
    state.department = '';
  }
  if (!state.department && !profile.department_id) {
    state.balance = null;
    state.users = [];
    state.transactions = [];
    state.bills = [];
    state.billsError = '';
    return;
  }
  const query = admin() ? `?department_id=${encodeURIComponent(state.department)}` : '';
  if (admin()) {
    [state.balance, state.users, state.transactions] = await Promise.all([
      api(`/credits/balance${query}`),
      api(`/admin/users${query}`),
      api(`/admin/credits/transactions${query}`),
    ]);
    try {
      state.bills = await api(`/bills${query}`);
      state.billsError = '';
    } catch (error) {
      state.bills = [];
      state.billsError = error.message;
    }
    try {
      state.emissions = await api(`/emissions${query}`);
      state.emissionsError = '';
    } catch (error) {
      state.emissions = null;
      state.emissionsError = error.message;
    }
  } else {
    if (dataOfficer()) {
      state.balance = await api('/credits/balance');
      try {
        state.bills = await api('/bills');
        state.billsError = '';
      } catch (error) {
        state.bills = [];
        state.billsError = error.message;
      }
    } else {
      state.balance = await api('/credits/balance');
      state.bills = [];
      state.billsError = '';
      if (complianceManager()) {
        try {
          state.emissions = await api('/emissions');
          state.emissionsError = '';
        } catch (error) {
          state.emissions = null;
          state.emissionsError = error.message;
        }
      }
    }
    state.users = [];
    state.transactions = [];
  }
}
async function execute(work, success) {
  if (state.busy) return;
  state.busy = true;
  state.notice = null;
  render();
  try {
    await work();
    if (success) state.notice = { type: 'success', text: success };
  } catch (error) {
    if (error.status === 401 && state.token) { clearSession(); navigate('login'); }
    state.notice = { type: 'error', text: error.message };
  } finally {
    state.busy = false;
    render();
  }
}
const logo = (dark = false) => `<span class="logo ${dark ? 'logo-dark' : ''}"><span class="logo-symbol">✳</span> atmos<span class="logo-period">.</span></span>`;

function marketingHeader() {
  return `<header class="marketing-header"><div class="site-container header-inner"><a href="#home" data-route="home" aria-label="Atmos home">${logo()}</a><nav class="marketing-links ${state.mobileMenu ? 'open' : ''}" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="#why-atmos">Why Atmos</a></nav><div class="marketing-actions">${state.profile ? `<button class="plain-link" data-route="dashboard">Go to dashboard ${icon('arrowUp', 16)}</button>` : `<button class="plain-link" data-route="login">Log in</button><button class="pill-button dark" data-route="register">Get started ${icon('arrowUp', 16)}</button>`}</div><button class="mobile-toggle" data-action="menu" aria-label="Toggle navigation">${icon(state.mobileMenu ? 'close' : 'menu', 23)}</button></div></header>`;
}
function planCard(name, plan, index, context = 'landing') {
  const featured = index === 1;
  return `<article class="pricing-card ${featured ? 'recommended' : ''}">${featured ? '<span class="recommended-label">MOST POPULAR</span>' : ''}<div class="pricing-card-top"><div class="plan-symbol ${esc(name)}">${icon(index === 0 ? 'spark' : index === 1 ? 'bolt' : 'layers', 21)}</div><span class="plan-caption">${name === 'starter' ? 'For getting started' : name === 'growth' ? 'For growing teams' : 'For bigger ideas'}</span></div><h3>${esc(name)}</h3><p class="plan-copy">${name === 'starter' ? 'A little goes a long way.' : name === 'growth' ? 'Room for your team to do more.' : 'Make space for the big stuff.'}</p><div class="plan-price">${money(plan)} <span>/ pack</span></div><div class="plan-credit"><strong>${count(plan.credits)}</strong> credits</div><div class="plan-divider"></div><ul><li>${icon('check', 16)} Shared across your department</li><li>${icon('check', 16)} Credits never expire</li><li>${icon('check', 16)} Track every credit used</li></ul><button class="pill-button ${featured ? 'dark' : 'outline'} plan-cta" data-${context === 'landing' ? 'route="register"' : `select-plan="${esc(name)}"`} ${state.busy || (context !== 'landing' && !admin()) ? 'disabled' : ''}>${context === 'landing' ? 'Get started' : admin() ? 'Choose ' + esc(name) : 'Admin access required'} ${icon('arrow', 17)}</button></article>`;
}
function landing() {
  return `<div class="marketing">${marketingHeader()}<section class="hero site-container"><div class="hero-copy"><div class="eyebrow-line"><span class="tiny-star">✳</span> THE WAY FORWARD IS TOGETHER</div><h1>More possibility.<br><span>Less friction.</span></h1><p>Give your team the freedom to move. One shared balance, simple prepaid credits, and a clearer way to keep great work going.</p><div class="hero-actions"><button class="pill-button dark large" data-route="${state.profile ? 'dashboard' : 'register'}">${state.profile ? 'Open your workspace' : 'Create your workspace'} ${icon('arrowUp', 18)}</button><a class="hero-text-link" href="#how-it-works">See how it works ${icon('arrow', 17)}</a></div><div class="hero-caption"><span class="avatar-stack"><i>J</i><i>M</i><i>A</i></span><span>Made for teams that make things happen.</span></div></div><div class="hero-visual"><div class="visual-sun"></div><div class="visual-orbit orbit-one"></div><div class="visual-orbit orbit-two"></div><div class="visual-spark spark-one">✳</div><div class="visual-spark spark-two">✦</div><div class="visual-caption top-caption"><span class="caption-icon">${icon('spark', 20)}</span><span>Good things grow together.</span></div><div class="visual-card"><div class="visual-card-header"><span>${logo(true)}</span><span class="visual-mini-icon">${icon('arrowUp', 17)}</span></div><div class="visual-card-bottom"><span>YOUR SHARED SPACE</span><strong>More room<br>to create<span class="visual-dot">.</span></strong><div class="visual-card-footer"><span>WORK BETTER, TOGETHER</span><span>✳ ✳ ✳</span></div></div></div><div class="visual-caption bottom-caption"><span class="caption-icon warm">${icon('bolt', 18)}</span><span>Keep the momentum going</span></div></div></section><div class="marquee"><div class="site-container marquee-inner"><span>ONE BALANCE</span><b>✳</b><span>YOUR WHOLE TEAM</span><b>✳</b><span>ENDLESS MOMENTUM</span><b>✳</b><span>ALL IN ONE PLACE</span></div></div><section id="how-it-works" class="how site-container"><div class="section-intro"><div class="eyebrow-line"><span class="tiny-star">✳</span> A BETTER WAY TO WORK</div><h2>Everything flows<br><em>better together.</em></h2><p>All the essentials to keep your people moving, without the busywork getting in the way.</p></div><div class="feature-grid"><article class="feature-card peach"><span class="feature-icon">${icon('wallet', 25)}</span><span class="feature-number">01 /</span><h3>One balance.<br>Everyone covered.</h3><p>Buy credits once and your whole department can put them to work. No individual wallets, no extra steps.</p><div class="feature-art coins-art"><span></span><span></span><span></span></div></article><article class="feature-card lilac"><span class="feature-icon">${icon('people', 25)}</span><span class="feature-number">02 /</span><h3>Bring the whole<br>team along.</h3><p>Make room for everyone. Set up departments, add your people, and keep it all in sync.</p><div class="feature-art people-art"><span>J</span><span>A</span><span>M</span></div></article><article class="feature-card butter"><span class="feature-icon">${icon('clock', 25)}</span><span class="feature-number">03 /</span><h3>Know where<br>you stand.</h3><p>See your balance and credit history at a glance. A little clarity goes a long way.</p><div class="feature-art bars-art"><span></span><span></span><span></span><span></span><span></span></div></article></div></section><section class="story" id="why-atmos"><div class="site-container story-inner"><div class="story-art"><div class="story-disc"><div class="disc-ring">✳</div><div class="disc-center">a<span>.</span></div></div><span class="story-float one">✦</span><span class="story-float two">✳</span></div><div class="story-copy"><span class="eyebrow-line">MADE FOR MOMENTUM</span><h2>Your people have<br>big things to do.<br><em>Let them.</em></h2><p>When the little things just work, everyone has more room for what matters. Atmos gives your team a simpler way to share resources and keep moving forward.</p><button class="pill-button light" data-route="${state.profile ? 'dashboard' : 'register'}">Find your flow ${icon('arrowUp', 17)}</button></div></div></section><section class="pricing-section site-container" id="pricing"><div class="pricing-heading"><div><div class="eyebrow-line"><span class="tiny-star">✳</span> SIMPLE BY DESIGN</div><h2>Pick your pace.<br><em>Grow your way.</em></h2></div><p>Start where you are. Add more when you need it. Every pack is shared with your team and never expires.</p></div><div class="pricing-grid">${Object.entries(state.plans).map(([name, plan], index) => planCard(name, plan, index)).join('') || '<p>Loading plans…</p>'}<p class="pricing-disclaimer">Purchases currently add demo credits. No payment is collected.</p></div></section><section class="final-cta"><div class="site-container final-inner"><span class="eyebrow-line">GOOD THINGS START HERE</span><h2>Make space for<br><em>what’s next.</em></h2><p>Your team has somewhere to go. Let’s get moving.</p><button class="pill-button light large" data-route="${state.profile ? 'dashboard' : 'register'}">${state.profile ? 'Go to dashboard' : 'Create your workspace'} ${icon('arrowUp', 18)}</button><div class="cta-decoration">✳</div></div></section><footer class="marketing-footer site-container"><a href="#home" data-route="home">${logo()}</a><span>Better together, every day.</span><span>© ${new Date().getFullYear()} Atmos</span></footer></div>`;
}

function authPageWithDepartment() {
  const register = state.route === 'register';
  return `<div class="auth-layout"><section class="auth-side"><a href="#home" data-route="home">${logo(true)}</a><div class="auth-side-center"><span class="eyebrow-line">A LITTLE SPACE TO DO A LOT</span><h2>Good things<br>start <em>together.</em></h2><p>One place for your people and your possibilities.</p><div class="auth-art"><span class="auth-art-ring"></span><span class="auth-art-star">✳</span><span class="auth-art-small">✦</span></div></div><span class="auth-side-footer">ATMOS · MADE FOR MOMENTUM</span></section><section class="auth-main"><div class="auth-top"><button class="text-action" data-route="home">← Back to home</button><span>${register ? 'Already have an account?' : 'New to Atmos?'} <button class="text-action emphasized" data-route="${register ? 'login' : 'register'}">${register ? 'Log in' : 'Get started'}</button></span></div><div class="auth-form-container"><span class="eyebrow-line"><span class="tiny-star">✳</span> ${register ? 'WELCOME TO ATMOS' : 'WELCOME BACK'}</span><h1>${register ? 'Let’s build something great.' : 'Good to have you back.'}</h1><p>${register ? 'Create your workspace and bring your team along.' : 'Pick up right where you left off.'}</p><form data-form="${register ? 'register' : 'login'}">${register ? field('Your name', 'name', 'text', 'placeholder="Alex Morgan" autocomplete="name" maxlength="255"') + field('Workspace / department name', 'department_name', 'text', 'placeholder="Your team’s name" maxlength="255"') : ''}${field('Work email', 'email', 'email', 'placeholder="you@company.com" autocomplete="username"')}${field('Password', 'password', 'password', `placeholder="${register ? 'At least 8 characters' : 'Your password'}" autocomplete="${register ? 'new-password' : 'current-password'}" ${register ? 'minlength="8" maxlength="128"' : ''}`)}<button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'One moment…' : register ? 'Create my workspace' : 'Log in to my workspace'} ${icon('arrow', 18)}</button></form><div class="auth-footnote">${icon('shield', 16)} Your workspace is yours. We’re glad you’re here.</div></div></section></div>`;
}
function authPage() {
  return authPageWithDepartment()
    .replace(/<label class="field"><span>Workspace \/ department name<\/span>.*?<\/label>/, '')
    .replace('Create your workspace and bring your team along.', 'Create your account. Add your first department whenever you’re ready.')
    .replace('Create my workspace', 'Create my account');
}

function departmentSelect() {
  if (!admin() || state.departments.length < 2) return '';
  return `<label class="workspace-selector">Workspace <span class="select-wrap"><select id="department-select" ${state.busy ? 'disabled' : ''}>${state.departments.map((department) => `<option value="${department.id}" ${String(department.id) === state.department ? 'selected' : ''}>${esc(department.name)}</option>`).join('')}</select>${icon('down', 15)}</span></label>`;
}
function shell(body) {
  const initials = state.profile.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = admin() ? 'Workspace admin' : dataOfficer() ? 'Data officer' : 'Compliance manager';
  return `<div class="workspace"><aside class="app-sidebar"><a href="#home" data-route="home" class="app-logo">${logo()}</a><span class="nav-title">YOUR WORKSPACE</span><nav aria-label="Workspace navigation">${visibleNav().map(([key, label, symbol]) => `<button data-route="${key}" class="side-link ${state.route === key ? 'active' : ''}">${icon(symbol, 19)}<span>${label}</span>${state.route === key ? '<span class="active-pip"></span>' : ''}</button>`).join('')}</nav><div class="sidebar-help"><span class="help-icon">✳</span><h3>More room to grow.</h3><p>Your team’s next big thing is just around the corner.</p><button data-route="purchase">Explore credit packs ${icon('arrow', 15)}</button></div><div class="sidebar-profile"><span class="person-avatar">${esc(initials)}</span><span><strong>${esc(state.profile.name)}</strong><small>${roleLabel}</small></span><button data-action="logout" title="Log out" aria-label="Log out" ${state.busy ? 'disabled' : ''}>${icon('logout', 18)}</button></div></aside><div class="app-main"><header class="app-header"><div class="mobile-app-logo">${logo()}</div><div class="header-greeting">YOUR SPACE TO DO MORE <span>✳</span></div><div class="header-tools">${departmentSelect()}<span class="header-avatar">${esc(initials)}</span><button class="header-signout" data-action="logout" ${state.busy ? 'disabled' : ''}>Sign out</button></div></header><div class="app-content">${toast()}${body}</div><nav class="bottom-nav" aria-label="Mobile workspace navigation">${visibleNav().map(([key, label, symbol]) => `<button data-route="${key}" class="${state.route === key ? 'active' : ''}">${icon(symbol, 20)}<span>${label.split(' ')[0]}</span></button>`).join('')}</nav></div></div>`;
}
const pageHead = (eyebrow, title, description, action = '') => `<div class="page-head"><div><span class="eyebrow-line"><span class="tiny-star">✳</span> ${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
function activityRows(limit = 0) {
  const items = limit ? state.transactions.slice(0, limit) : state.transactions;
  if (!items.length) return `<div class="empty-state"><span class="empty-icon">${icon('clock', 24)}</span><h3>Nothing here just yet.</h3><p>Once your team starts using credits, you’ll see it all here.</p></div>`;
  return `<div class="transaction-list">${items.map((tx) => `<div class="transaction-row"><span class="transaction-icon ${tx.kind}">${icon(tx.amount > 0 ? 'plus' : 'arrowUp', 18)}</span><div class="transaction-description"><strong>${tx.kind === 'purchase' ? `${esc(tx.plan || 'Credit')} pack added` : tx.kind === 'transfer_in' ? 'Credits received from another department' : tx.kind === 'transfer_out' ? 'Credits shared with another department' : tx.kind === 'emission_offset' ? 'Carbon credits retired for analyzed emissions' : 'Credits used'}</strong><span>${when(tx.created_at)} · Team member #${tx.actor_id}</span></div><strong class="transaction-amount ${tx.amount > 0 ? 'incoming' : ''}">${tx.amount > 0 ? '+' : ''}${count(tx.amount)}</strong></div>`).join('')}</div>`;
}
function dashboardWithDepartment() {
  const name = esc(state.profile.name.split(' ')[0]);
  return `${pageHead('THE GOOD STUFF STARTS HERE', `Hello, ${name}<span class="heading-wave">✳</span>`, 'Here’s what’s happening in your workspace today.', `<button class="subtle-button" data-action="refresh" ${state.busy ? 'disabled' : ''}>${icon('refresh', 16)} Refresh</button>`)}<section class="balance-hero"><div class="balance-hero-copy"><span class="balance-kicker"><span class="live-dot"></span> YOUR TEAM’S SHARED BALANCE</span><div class="big-balance">${count(state.balance?.balance)}<span>credits</span></div><p>Ready for whatever’s next in <strong>${esc(state.balance?.department_name || 'your workspace')}</strong>.</p>${admin() ? `<button class="pill-button light" data-route="purchase">Add more credits ${icon('arrowUp', 17)}</button>` : `<span class="balance-message">Your team shares this balance. Let’s make it count.</span>`}</div><div class="balance-art"><div class="art-halo"></div><div class="art-circle one"></div><div class="art-circle two"></div><div class="art-center">✳</div><span class="art-tiny">✦</span></div></section><div class="overview-stat-grid"><article class="overview-stat"><span class="stat-icon apricot">${icon('wallet', 20)}</span><span>Available credits</span><strong>${count(state.balance?.balance)}</strong><small>Ready to use</small></article><article class="overview-stat"><span class="stat-icon violet">${icon('people', 20)}</span><span>Team members</span><strong>${admin() ? count(state.users.length) : '—'}</strong><small>${admin() ? 'In this department' : 'Shared workspace'}</small></article><article class="overview-stat"><span class="stat-icon mint">${icon('layers', 20)}</span><span>Departments</span><strong>${admin() ? count(state.departments.length) : '1'}</strong><small>${admin() ? 'In your workspace' : 'Your home department'}</small></article></div><div class="dashboard-columns"><section class="surface-card"><div class="card-heading"><div><span class="overline">KEEP THINGS MOVING</span><h2>Quick actions</h2></div></div><div class="action-list">${admin() ? `<button data-route="purchase"><span class="action-icon peach-icon">${icon('plus', 19)}</span><span><strong>Top up your balance</strong><small>Find the right pack for your team</small></span>${icon('arrowUp', 17)}</button><button data-route="team"><span class="action-icon lavender-icon">${icon('people', 19)}</span><span><strong>Bring someone in</strong><small>Make room for another team member</small></span>${icon('arrowUp', 17)}</button>` : `<div class="quiet-message">Your workspace is ready to use. Your admin manages packs and teammates.</div>`}<button data-route="activity"><span class="action-icon yellow-icon">${icon('clock', 19)}</span><span><strong>See your activity</strong><small>Keep up with your credit history</small></span>${icon('arrowUp', 17)}</button></div></section><section class="surface-card"><div class="card-heading"><div><span class="overline">IN YOUR WORKSPACE</span><h2>Recent activity</h2></div><button class="link-button" data-route="activity">View all ${icon('arrow', 16)}</button></div>${admin() ? activityRows(3) : `<div class="empty-state"><span class="empty-icon">${icon('shield', 24)}</span><h3>Your team’s balance is shared.</h3><p>Ask your admin for the full department transaction history.</p></div>`}</section></div><div class="dashboard-tip"><span>✳</span><p><strong>Better together.</strong> Credits are shared by everyone in your department and never expire.</p></div>`;
}
function dashboard() {
  if (admin() && !state.departments.length) return `${pageHead('WELCOME TO ATMOS', `Hello, ${esc(state.profile.name.split(' ')[0])} ✳`, 'Your account is ready. Start by creating a department for your team.')}<section class="first-department"><span class="first-department-icon">${icon('layers', 32)}</span><span class="eyebrow-line">FIRST THINGS FIRST</span><h2>Give your team a place to begin.</h2><p>Create your first department when you’re ready. After that, you can add teammates to it and share credits.</p><button class="pill-button dark" data-route="departments">Create a department ${icon('arrow', 17)}</button></section>`;
  return dashboardWithDepartment();
}
function purchaseWithDepartment() {
  const [name, plan] = state.selectedPlan ? [state.selectedPlan, state.plans[state.selectedPlan]] : [];
  return `${pageHead('FUEL THE NEXT BIG THING', 'Choose your next move.', 'Simple prepaid credits for all the things your team is ready to do.')}${admin() ? `<div class="purchase-balance">${icon('wallet', 21)}<span>Your current balance in <strong>${esc(state.balance?.department_name)}</strong></span><strong>${count(state.balance?.balance)} credits</strong></div>` : `<div class="purchase-balance">${icon('shield', 21)}<span>Only a workspace admin can add credits. Your shared balance is <strong>${count(state.balance?.balance)} credits</strong>.</span></div>`}<div class="purchase-heading"><div><span class="overline">CREDIT PACKS</span><h2>A little or a lot. It’s your call.</h2></div><p>Every credit stays with your team until you use it.</p></div><div class="pricing-grid app-pricing">${Object.entries(state.plans).map(([key, details], index) => planCard(key, details, index, 'app')).join('') || '<p>Loading plans…</p>'}</div>${state.selectedPlan && plan ? `<div class="modal-backdrop" data-action="close-modal"><section class="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button class="modal-close" data-action="close-modal" aria-label="Close">${icon('close', 20)}</button><span class="eyebrow-line"><span class="tiny-star">✳</span> ONE STEP AWAY</span><h2 id="checkout-title">Ready to keep going?</h2><p>Review the pack for your team before you add it.</p><div class="checkout-summary"><div><span>Credit pack</span><strong>${esc(name[0].toUpperCase() + name.slice(1))}</strong></div><div><span>Credits to add</span><strong>+${count(plan.credits)}</strong></div><div><span>Displayed pack price</span><strong>${money(plan)}</strong></div><div><span>New balance</span><strong>${count((state.balance?.balance || 0) + plan.credits)} credits</strong></div></div><div class="demo-note">${icon('shield', 18)} Demo purchase: credits are added immediately. No payment is collected.</div><button class="pill-button dark full-width" data-action="confirm-purchase" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Adding credits…' : `Add ${count(plan.credits)} credits`} ${icon('arrow', 18)}</button></section></div>` : ''}<div class="purchase-footnote">${icon('spark', 21)} <span>Credits are shared with your team and never expire. <strong>Keep making good things happen.</strong></span></div>`;
}
function purchase() {
  if (admin() && !state.departments.length) return `${pageHead('CREDIT PACKS', 'First, make room for your team.', 'Create a department before adding credits to its shared balance.')}<section class="first-department"><span class="first-department-icon">${icon('layers', 32)}</span><h2>Your credits need a home.</h2><p>Create your first department, then choose a credit pack for your team.</p><button class="pill-button dark" data-route="departments">Create a department ${icon('arrow', 17)}</button></section>`;
  if (!Object.keys(state.plans).length) {
    if (!state.plansLoading && !state.plansError) void loadPlans();
    return `${pageHead('CREDIT PACKS', 'Buy credits.', 'Choose a pack for your department.')}<section class="surface-card"><div class="empty-state"><h3>${state.plansLoading ? 'Loading credit packs…' : 'Could not load credit packs.'}</h3><p>${esc(state.plansError || 'Fetching the latest available plans.')}</p>${state.plansLoading ? '' : '<button class="pill-button dark" data-action="reload-plans">Try again</button>'}</div></section>`;
  }
  return purchaseWithDepartment();
}
function activity() {
  if (admin() && !state.departments.length) return `${pageHead('WORKSPACE ACTIVITY', 'Your story starts here.', 'Create your first department to start tracking credits.')}<section class="surface-card">${activityRows()}</section>`;
  if (!admin()) return `${pageHead('WORKSPACE ACTIVITY', 'Every move matters.', 'Your admin can view the department’s full credit history.')}<section class="surface-card">${activityRows()}</section>`;
  return `${pageHead('WORKSPACE ACTIVITY', 'Every move matters.', 'A clear view of the credits coming in and going out.')}<div class="activity-summary"><span class="stat-icon violet">${icon('clock', 21)}</span><div><strong>${count(state.transactions.length)} transactions</strong><span>For ${esc(state.balance?.department_name)}</span></div><span class="summary-balance">${count(state.balance?.balance)} credits available</span></div><section class="surface-card activity-card"><div class="card-heading"><div><span class="overline">YOUR CREDIT HISTORY</span><h2>Recent transactions</h2></div></div>${activityRows()}</section>`;
}
const fileSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
function bills() {
  const rows = state.billsError ? `<div class="empty-state"><span class="empty-icon">${icon('refresh', 25)}</span><h3>Could not load stored bills.</h3><p>${esc(state.billsError)}</p><button class="subtle-button" data-action="refresh">Try again</button></div>` : state.bills.length ? `<div class="bill-list">${state.bills.map((bill) => `<div class="bill-row"><span class="bill-file-icon">${icon('file', 21)}</span><span class="bill-details"><strong>${esc(bill.filename)}</strong><small>${when(bill.created_at)} · ${fileSize(bill.size_bytes)}</small></span><button class="bill-download" data-action="download-bill" data-bill-id="${bill.id}" data-filename="${esc(bill.filename)}" ${state.busy ? 'disabled' : ''} aria-label="Download ${esc(bill.filename)}">${icon('download', 18)} Download</button></div>`).join('')}</div>` : `<div class="empty-state"><span class="empty-icon">${icon('file', 25)}</span><h3>No bills uploaded yet.</h3><p>Your stored PDF bills will appear here.</p></div>`;
  const upload = `<section class="surface-card bill-upload-card"><span class="overline">ADD SUPPORTING DOCUMENT</span><h2>Upload a bill</h2><p>Select a PDF bill to store securely with this department’s records.</p><form data-form="bill"><label class="file-drop"><input name="file" type="file" accept="application/pdf,.pdf" required><span class="upload-mark">${icon('upload', 24)}</span><strong>Choose a PDF bill</strong><small>PDF only, up to 10 MB</small></label><button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Uploading…' : 'Upload and store bill'} ${icon('arrow', 17)}</button></form></section>`;
  const eyebrow = dataOfficer() ? 'DATA OFFICER WORKSPACE' : 'ADMIN BILL RECORDS';
  const description = dataOfficer() ? 'Upload supporting bills and track the carbon credits allocated by your admin.' : `Review bills uploaded for ${esc(state.balance?.department_name || 'the selected department')}.`;
  return `${pageHead(eyebrow, 'Bills and carbon credits.', description, `<button class="subtle-button" data-action="refresh" ${state.busy ? 'disabled' : ''}>${icon('refresh', 16)} Refresh</button>`)}<section class="carbon-balance"><span class="stat-icon mint">${icon('spark', 21)}</span><div><span>${dataOfficer() ? 'CARBON CREDITS GIVEN BY ADMIN' : 'DEPARTMENT CARBON CREDITS'}</span><strong>${count(state.balance?.balance)}</strong><small>Available for ${esc(state.balance?.department_name || 'your department')}</small></div><span class="live-balance"><i></i> Updated balance</span></section><div class="bill-grid">${upload}<section class="surface-card stored-bills"><div class="card-heading"><div><span class="overline">DEPARTMENT RECORDS</span><h2>Stored bills <small class="count-tag">${state.bills.length}</small></h2></div></div>${rows}</section></div>`;
}
const carbon = (kg) => Number(kg || 0) >= 1000 ? `${(Number(kg) / 1000).toFixed(2)} t` : `${Number(kg || 0).toFixed(1)} kg`;
const monthLabel = (period) => new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
function emissions() {
  if (state.emissionsError) return `${pageHead('COMPLIANCE INTELLIGENCE', 'Your emissions picture.', 'Carbon estimates generated from uploaded department bills.')}<section class="surface-card"><div class="empty-state"><span class="empty-icon">${icon('refresh', 25)}</span><h3>Could not load emissions data.</h3><p>${esc(state.emissionsError)}</p><button class="subtle-button" data-action="refresh">Try again</button></div></section>`;
  const data = state.emissions || { total_co2e_kg: 0, credits_used: 0, pending_credit_applications: 0, analyzed_bills: 0, pending_bills: 0, monthly: [], categories: [], suggestions: [], records: [], ai_configured: false };
  const monthlyMax = Math.max(...data.monthly.map((item) => Number(item.co2e_kg)), 1);
  const total = Number(data.total_co2e_kg || 0);
  const latest = data.monthly.at(-1);
  const previous = data.monthly.at(-2);
  const change = previous?.co2e_kg ? (Number(latest.co2e_kg) - Number(previous.co2e_kg)) / Number(previous.co2e_kg) * 100 : null;
  const trendText = change === null ? 'Add another month to see whether emissions are rising or falling.' : `${Math.abs(change).toFixed(0)}% ${change <= 0 ? 'lower' : 'higher'} than the previous month.`;
  const monthlyGraph = data.monthly.length ? `<div class="trend-summary ${change !== null && change > 0 ? 'trend-up' : ''}"><span>${change === null ? 'FIRST MONTH RECORDED' : change <= 0 ? 'MOVING IN THE RIGHT DIRECTION' : 'NEEDS ATTENTION'}</span><strong>${trendText}</strong></div><div class="emission-timeline">${data.monthly.map((item) => `<div class="timeline-row"><span>${esc(monthLabel(item.period))}</span><div class="timeline-track"><i style="width:${Math.max(3, Number(item.co2e_kg) / monthlyMax * 100)}%"></i></div><strong>${carbon(item.co2e_kg)}</strong></div>`).join('')}</div><p class="chart-footnote">Longer bars mean more emissions. The highest month is shown at full width.</p>` : '<div class="chart-empty">Analyze uploaded bills to build your monthly trend.</div>';
  const categoryGraph = data.categories.length ? `<div class="category-bars">${data.categories.map((item) => { const share = total ? Number(item.co2e_kg) / total * 100 : 0; return `<div class="category-bar"><span><strong>${esc(item.category)}</strong><small>${share.toFixed(0)}% of total · ${carbon(item.co2e_kg)}</small></span><div><i style="width:${Math.max(3, share)}%"></i></div></div>`; }).join('')}</div><p class="chart-footnote">Start with the largest percentage for the biggest reduction opportunity.</p>` : '<div class="chart-empty">Emission sources will appear after analysis.</div>';
  const suggestions = data.suggestions.length ? data.suggestions.map((tip, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(tip)}</p></li>`).join('') : '<li class="tip-empty"><p>Analyze a bill to receive actions tailored to your actual consumption.</p></li>';
  const records = data.records.length ? data.records.slice(0, 6).map((record) => `<div class="emission-record"><span class="record-category">${esc(record.category)}</span><div><strong>${carbon(record.co2e_kg)} CO₂e</strong><p>${esc(record.summary)}</p></div><span class="confidence">${Math.round(Number(record.confidence) * 100)}% confidence</span></div>`).join('') : '<div class="chart-empty">No analyzed bills yet.</div>';
  const actionLabel = state.busy ? 'Updating emissions…' : data.pending_bills ? `Analyze ${data.pending_bills} pending bill${data.pending_bills === 1 ? '' : 's'}` : data.pending_credit_applications ? 'Reconcile carbon credits' : 'All bills analyzed';
  const actionDisabled = state.busy || (!data.pending_bills && !data.pending_credit_applications) || (data.pending_bills && !data.ai_configured);
  return `${pageHead('COMPLIANCE INTELLIGENCE', 'Your emissions, made clear.', 'See where emissions come from, whether they are improving, and what to do next.', `<button class="pill-button dark" data-action="analyze-emissions" ${actionDisabled ? 'disabled' : ''}>${actionLabel} ${icon('spark', 16)}</button>`)}${!data.ai_configured && data.pending_bills ? '<div class="analytics-alert">Azure analysis is not configured. Set <code>AZURE_AI_PROJECT_ENDPOINT</code>, <code>AZURE_AI_API_KEY</code>, and <code>AZURE_AI_MODEL</code> on the backend.</div>' : ''}${total ? `<section class="carbon-explainer"><div><span>WHAT DOES ${carbon(total).toUpperCase()} CO₂e MEAN?</span><strong>About the same climate impact as driving <em>${count(Math.round(total / 0.21))} km</em> in a typical petrol car.</strong></div><div><span>CARBON CREDITS RETIRED</span><strong><em>${count(data.credits_used)} credit${data.credits_used === 1 ? '' : 's'}</em> deducted at 1 credit per tonne CO₂e.</strong></div><p>CO₂e combines carbon dioxide and other greenhouse gases into one comparable number. Combined emissions are rounded up once: 9.50 tonnes uses 10 credits.</p></section>` : ''}<div class="emission-stats"><article><span>ESTIMATED EMISSIONS</span><strong>${carbon(data.total_co2e_kg)} CO₂e</strong><small>Lower is better</small></article><article><span>BILLS INCLUDED</span><strong>${count(data.analyzed_bills)}</strong><small>${count(data.pending_bills)} still waiting</small></article><article><span>BIGGEST EMISSION SOURCE</span><strong>${esc(data.categories[0]?.category || '—')}</strong><small>${data.categories[0] ? `${(Number(data.categories[0].co2e_kg) / Math.max(total, 1) * 100).toFixed(0)}% of your total` : 'No source data yet'}</small></article></div><div class="analytics-grid"><section class="surface-card trend-card"><div class="card-heading"><div><span class="overline">IS IT GETTING BETTER?</span><h2>Emissions each month</h2><p>Measured in kilograms of CO₂ equivalent</p></div></div>${monthlyGraph}</section><section class="surface-card source-card"><div class="card-heading"><div><span class="overline">WHERE TO ACT FIRST</span><h2>What causes your emissions?</h2><p>Each source shown as a share of the total</p></div></div>${categoryGraph}</section></div><div class="analytics-grid lower"><section class="surface-card"><div class="card-heading"><div><span class="overline">REDUCTION PLAYBOOK</span><h2>Recommended next moves</h2></div></div><ol class="reduction-tips">${suggestions}</ol></section><section class="surface-card"><div class="card-heading"><div><span class="overline">HOW WE CALCULATED IT</span><h2>Bill estimates</h2></div></div><div class="emission-records">${records}</div></section></div>`;
}
function teamWithDepartment() {
  return `${pageHead('THE PEOPLE BEHIND IT ALL', 'Better with your people.', 'Bring your teammates into your shared workspace.')}<div class="management-grid"><section class="surface-card"><div class="card-heading"><div><span class="overline">YOUR PEOPLE</span><h2>Team members <small class="count-tag">${state.users.length}</small></h2></div></div>${state.users.length ? `<div class="members">${state.users.map((person) => `<div class="member-row"><span class="person-avatar">${esc(person.name.slice(0, 2).toUpperCase())}</span><span><strong>${esc(person.name)}</strong><small>${esc(person.email)}</small></span><em>${esc(person.role)}</em></div>`).join('')}</div>` : `<div class="empty-state"><span class="empty-icon">${icon('people', 25)}</span><h3>Room for more.</h3><p>Add a teammate to get started together.</p></div>`}</section><section class="surface-card form-card"><span class="overline">GROW TOGETHER</span><h2>Add a team member</h2><p>Give someone access to this department’s shared credits.</p><form data-form="user">${field('Full name', 'name', 'text', 'placeholder="Sam Taylor" maxlength="255"')}${field('Email address', 'email', 'email', 'placeholder="sam@company.com"')}${field('Temporary password', 'password', 'password', 'placeholder="At least 8 characters" minlength="8" maxlength="128" autocomplete="new-password"')}<label class="field">Role<select name="role"><option value="employee">Team member</option><option value="admin">Department admin</option></select></label><button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Adding…' : 'Add team member'} ${icon('arrow', 17)}</button></form></section></div>`;
}
function team() {
  if (!state.departments.length) return `${pageHead('TEAM MEMBERS', 'First, create a department.', 'Every team member needs a department to call home.')}<section class="first-department"><h2>Make space for your team.</h2><p>Create your first department, then add your people to it.</p><button class="pill-button dark" data-route="departments">Create a department ${icon('arrow', 17)}</button></section>`;
  const selector = `<label class="field">Assign to department<select name="department_id">${state.departments.map((department) => `<option value="${department.id}" ${String(department.id) === state.department ? 'selected' : ''}>${esc(department.name)}</option>`).join('')}</select></label>`;
  return teamWithDepartment()
    .replace('<label class="field">Role', `${selector}<label class="field">Role`)
    .replace(/<select name="role">.*?<\/select>/, '<select name="role" required><option value="data_officer">Data Officer</option><option value="compliance_manager">Compliance Manager</option></select>')
    .replaceAll('data_officer</em>', 'Data Officer</em>')
    .replaceAll('compliance_manager</em>', 'Compliance Manager</em>');
}
function departmentsWithHome() {
  const owner = state.departments.some((department) => department.id === state.profile.department_id && department.owner_id === state.profile.user_id);
  return `${pageHead('SPACE FOR EVERY TEAM', 'Every team has a place.', 'Keep your people and their shared credits organized.')}<div class="management-grid"><section class="surface-card"><div class="card-heading"><div><span class="overline">YOUR DEPARTMENTS</span><h2>Spaces you manage <small class="count-tag">${state.departments.length}</small></h2></div></div><div class="departments-list">${state.departments.map((department) => `<div class="department-row"><span class="stat-icon violet">${icon('layers', 20)}</span><span><strong>${esc(department.name)}</strong><small>${department.id === state.profile.department_id ? 'Your home department' : 'A space for your team'}</small></span>${String(department.id) === state.department ? '<span class="current-tag">Viewing</span>' : ''}</div>`).join('')}</div></section>${owner ? `<section class="surface-card form-card"><span class="overline">MAKE ROOM FOR MORE</span><h2>Add a department</h2><p>A new shared space with its own balance, ready for your team.</p><form data-form="department">${field('Department name', 'name', 'text', 'placeholder="e.g. Design team" maxlength="255"')}<button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Creating…' : 'Create department'} ${icon('arrow', 17)}</button></form></section>` : `<section class="surface-card form-card"><span class="overline">YOUR WORKSPACE</span><h2>One team, shared momentum.</h2><p>Your workspace owner manages new departments. You can keep things moving with the team you have.</p></section>`}</div>`;
}
function departments() {
  if (state.departments.length) {
    const owner = state.departments.some((department) => department.id === state.profile.department_id && department.owner_id === state.profile.user_id);
    const transfer = owner && state.departments.length > 1 ? `<section class="surface-card transfer-card"><div><span class="overline">SHARED MOMENTUM</span><h2>Share credits between teams</h2><p>Move available credits from one of your departments to another. Both balances update immediately.</p></div><form data-form="transfer"><label class="field">From department<select name="from_department_id">${state.departments.map((department) => `<option value="${department.id}" ${String(department.id) === state.department ? 'selected' : ''}>${esc(department.name)}</option>`).join('')}</select></label><label class="field">To department<select name="to_department_id">${state.departments.map((department) => `<option value="${department.id}">${esc(department.name)}</option>`).join('')}</select></label>${field('Credits to share', 'credits', 'number', 'min="1" max="100000" step="1" placeholder="e.g. 25"')}<button class="pill-button dark" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Sharing…' : 'Share credits'} ${icon('arrow', 17)}</button></form></section>` : '';
    return departmentsWithHome() + transfer;
  }
  return `${pageHead('SPACE FOR EVERY TEAM', 'Start with a department.', 'You choose when to create your first department, then assign people to it.')}<div class="management-grid"><section class="first-department"><span class="first-department-icon">${icon('layers', 32)}</span><h2>A place for your people.</h2><p>Departments have their own shared balance. Once you create one, you can add teammates and credits.</p></section><section class="surface-card form-card"><span class="overline">LET’S GET STARTED</span><h2>Create your first department</h2><p>Name the team or space you want to organize.</p><form data-form="department">${field('Department name', 'name', 'text', 'placeholder="e.g. Design team" maxlength="255"')}<button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Creating…' : 'Create department'} ${icon('arrow', 17)}</button></form></section></div>`;
}

function render() {
  if (state.loading) { app.innerHTML = '<div class="loading-screen">✳ <span>atmos.</span></div>'; return; }
  if (nav.some(([key]) => key === state.route) && !state.profile) { navigate('login'); return; }
  if (dataOfficer() && nav.some(([key]) => key === state.route) && state.route !== 'bills') { navigate('bills'); return; }
  const content = {
    home: landing,
    login: authPage,
    register: authPage,
    dashboard,
    purchase,
    bills: admin() || dataOfficer() ? bills : dashboard,
    emissions: admin() || complianceManager() ? emissions : dashboard,
    activity,
    team: admin() ? team : dashboard,
    departments: admin() ? departments : dashboard,
  }[state.route]();
  app.innerHTML = state.profile && !['home', 'login', 'register'].includes(state.route) ? shell(content) : `${content}${toast()}`;
  if (complianceManager()) app.querySelector('.sidebar-help button')?.remove();
  const source = app.querySelector('[name="from_department_id"]');
  const destination = app.querySelector('[name="to_department_id"]');
  if (source && destination && source.value === destination.value) {
    destination.value = [...destination.options].find((option) => option.value !== source.value)?.value ?? '';
  }
  document.title = `${state.route === 'home' ? 'Atmos — Better together' : `${state.route[0].toUpperCase() + state.route.slice(1)} · Atmos`}`;
}

window.addEventListener('hashchange', () => {
  if (['how-it-works', 'pricing', 'why-atmos'].includes(location.hash.slice(1))) { state.mobileMenu = false; return; }
  const route = routeFromHash();
  if (state.route === route) return;
  state.route = route;
  state.selectedPlan = null;
  state.mobileMenu = false;
  render();
  window.scrollTo(0, 0);
});
app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-route], [data-action], [data-select-plan]');
  if (!target || target.disabled) return;
  if (target.dataset.route) { event.preventDefault(); navigate(target.dataset.route); }
  if (target.dataset.selectPlan) { state.selectedPlan = target.dataset.selectPlan; render(); }
  if (target.dataset.action === 'menu') { state.mobileMenu = !state.mobileMenu; render(); }
  if (target.dataset.action === 'dismiss') { state.notice = null; render(); }
  if (target.dataset.action === 'reload-plans') { void loadPlans(); render(); }
  if (target.dataset.action === 'close-modal' && (target === event.target || target.classList.contains('modal-close'))) { state.selectedPlan = null; render(); }
  if (target.dataset.action === 'refresh') execute(async () => { state.plans = await api('/credits/plans', { token: '' }); await refresh(); }, 'Your workspace is up to date.');
  if (target.dataset.action === 'logout') execute(async () => { await api('/auth/logout', { method: 'POST' }); clearSession(); navigate('home'); }, 'You’re signed out. See you soon!');
  if (target.dataset.action === 'confirm-purchase') execute(async () => {
    await api('/admin/credits/purchases', { method: 'POST', body: { plan: state.selectedPlan, department_id: Number(state.department) } });
    await refresh();
    navigate('dashboard');
  }, 'Credits added! Your whole team can use them now.');
  if (target.dataset.action === 'download-bill') execute(async () => {
    const blob = await api(`/bills/${encodeURIComponent(target.dataset.billId)}/file`, { responseType: 'blob', timeout: 120000 });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = target.dataset.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (target.dataset.action === 'analyze-emissions') execute(async () => {
    const query = admin() ? `?department_id=${encodeURIComponent(state.department)}` : '';
    const result = await api(`/emissions/analyze${query}`, { method: 'POST', timeout: 300000 });
    state.emissions = result;
    state.emissionsError = '';
    await refresh();
    if (result.errors?.length) throw new Error(result.errors.map((item) => `${item.filename}: ${item.error}`).join('; '));
  }, 'Bill analysis is complete. Your emissions dashboard is updated.');
});
app.addEventListener('change', (event) => {
  if (event.target.name === 'from_department_id') {
    const destination = app.querySelector('[name="to_department_id"]');
    if (destination?.value === event.target.value) {
      destination.value = [...destination.options].find((option) => option.value !== event.target.value)?.value ?? '';
    }
  }
  if (event.target.id === 'department-select') {
    state.department = event.target.value;
    execute(refresh);
  }
});
app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  execute(async () => {
    switch (form.dataset.form) {
      case 'register':
        await api('/auth/register', { method: 'POST', body: values, token: '' });
      case 'login': {
        const { access_token } = await api('/auth/login', { method: 'POST', body: { email: values.email, password: values.password }, token: '' });
        clearSession();
        state.token = access_token;
        sessionStorage.setItem('atmos.token', access_token);
        await refresh();
        navigate(dataOfficer() ? 'bills' : complianceManager() ? 'emissions' : 'dashboard');
        break;
      }
      case 'user':
        await api('/admin/users', { method: 'POST', body: { ...values, department_id: Number(values.department_id) } });
        await refresh();
        break;
      case 'department':
        await api('/admin/departments', { method: 'POST', body: values });
        await refresh();
        break;
      case 'transfer':
        if (values.from_department_id === values.to_department_id) throw new Error('Choose two different departments to share credits.');
        await api('/admin/credits/transfers', { method: 'POST', body: {
          from_department_id: Number(values.from_department_id),
          to_department_id: Number(values.to_department_id),
          credits: Number(values.credits),
        } });
        await refresh();
        break;
      case 'bill': {
        const file = form.elements.file.files[0];
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF bill to upload.');
        if (file.size > 10 * 1024 * 1024) throw new Error('PDF bills must be 10 MB or smaller.');
        const body = new FormData();
        body.append('file', file);
        if (admin()) body.append('department_id', state.department);
        await api('/bills', { method: 'POST', body });
        await refresh();
        break;
      }
    }
  }, form.dataset.form === 'user' ? 'Your new teammate can now log in.' : form.dataset.form === 'department' ? 'Your new department is ready.' : form.dataset.form === 'transfer' ? 'Credits shared between your departments.' : form.dataset.form === 'bill' ? 'Your PDF bill has been stored.' : null);
});

render();
(async () => {
  try {
    await loadPlans();
    if (state.token) {
      try { await refresh(); } catch (error) { if (error.status === 401) clearSession(); else throw error; }
      if (dataOfficer() && nav.some(([key]) => key === state.route) && state.route !== 'bills') {
        state.route = 'bills';
        location.hash = 'bills';
      }
    }
  } catch (error) {
    state.notice = { type: 'error', text: error.message };
  } finally {
    state.loading = false;
    render();
  }
})();

setInterval(async () => {
  if (!admin() || !state.token || !state.department || state.busy || document.hidden) return;
  try {
    const balance = await api(`/credits/balance?department_id=${encodeURIComponent(state.department)}`);
    if (balance.balance !== state.balance?.balance) {
      state.balance = balance;
      render();
    }
  } catch {
    // The normal refresh and authentication flows surface actionable errors.
  }
}, 15000);
