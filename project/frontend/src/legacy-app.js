import './style.css';
import './carbon-theme.css';
import { request } from './api.js';
import { mountThreePlanet } from './three-planet.js';
import { enhanceMotion } from './motion-enhancements.js';

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
  message: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.5-.8L4 20l1.4-3.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
  send: '<path d="m21 3-7.5 18-3.8-7.7L2 9.5 21 3Z"/><path d="m9.7 13.3 4-4"/>',
  drive: '<path d="m8 3 4 7-4 7H3l4-7-4-7h5Zm4 7 4-7h5l-4 7 4 7h-5l-4-7Zm-4 7h5l4 7H8l-4-7h4Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z"/>',
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

function supportAssistant() {
  const messages = state.supportMessages.length ? state.supportMessages.map((item) => `<div class="support-message ${item.from}"><p>${esc(item.text)}</p>${item.route ? `<button data-route="${item.route}" data-action="close-support">${esc(item.actionLabel || 'Open page')} ${icon('arrow', 14)}</button>` : ''}</div>`).join('') : '<div class="support-message assistant"><p>Hi, I’m Atmos Help. I can guide you through bills, emissions, credit packs, reports, team access, and departments.</p></div>';
  return `<aside class="support-assistant ${state.supportOpen ? 'is-open' : ''}" aria-label="Atmos Help"><button class="support-launcher" data-action="toggle-support" aria-label="${state.supportOpen ? 'Close' : 'Open'} Atmos Help" aria-expanded="${state.supportOpen}">${icon(state.supportOpen ? 'close' : 'message', 22)}<span>Help</span></button><section class="support-panel" aria-live="polite"><header><span class="support-badge">${icon('shield', 15)} Guardrailed help</span><button data-action="toggle-support" aria-label="Close Atmos Help">${icon('close', 17)}</button></header><div class="support-intro"><strong>How can we help?</strong><p>Get guidance for using Atmos—never share credentials or payment information.</p></div><div class="support-messages">${messages}</div><div class="support-suggestions"><button data-action="support-suggest" data-question="How do I upload a bill?">Upload a bill</button><button data-action="support-suggest" data-question="How do I create a report?">Create a report</button><button data-action="support-suggest" data-question="How do carbon credits work?">Carbon credits</button></div><label class="support-input"><span class="sr-only">Ask Atmos Help</span><input data-support-input maxlength="500" value="${esc(state.supportDraft)}" placeholder="Ask about using Atmos…" ${state.supportBusy ? 'disabled' : ''}><button data-action="support-send" aria-label="Send question" ${state.supportBusy ? 'disabled' : ''}>${icon('send', 17)}</button></label><small>Guidance only. This assistant cannot access records, take payments, or change your workspace.</small></section></aside>`;
}

const routeFromHash = () => {
  const route = location.hash.slice(1).replace(/^\//, '').split('?')[0];
  return ['home', 'login', 'register', 'ai-cfo', 'privacy', 'terms', ...nav.map(([key]) => key)].includes(route) ? route : 'home';
};
const state = {
  route: routeFromHash(), token: sessionStorage.getItem('atmos.token') || '', profile: null,
  plans: {}, departments: [], users: [], bills: [], billsError: '', emissions: null, emissionsError: '', balance: null, transactions: [], department: '',
  busy: false, notice: null, selectedPlan: null, mobileMenu: false, loading: true,
  supportOpen: false, supportMessages: [], supportDraft: '', supportBusy: false,
  plansLoading: false, plansError: '',
};

const api = (path, options = {}) => request(path, { token: state.token, ...options });
let razorpayScript;
let googleApiScript;
let googleIdentityScript;
let googlePickerModule;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScript) razorpayScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    document.head.append(script);
  });
  return razorpayScript;
}
function loadGoogleScript(src, type) {
  const cached = type === 'api' ? googleApiScript : googleIdentityScript;
  if (cached) return cached;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Google Drive. Check your connection and try again.'));
    document.head.append(script);
  });
  if (type === 'api') googleApiScript = promise;
  else googleIdentityScript = promise;
  return promise;
}
function loadGooglePickerModule() {
  if (googlePickerModule) return googlePickerModule;
  googlePickerModule = Promise.all([
    loadGoogleScript('https://apis.google.com/js/api.js', 'api'),
    loadGoogleScript('https://accounts.google.com/gsi/client', 'identity'),
  ]).then(() => new Promise((resolve, reject) => {
    if (!window.gapi) { reject(new Error('Google Drive did not load. Check your connection and try again.')); return; }
    window.gapi.load('picker', {
      callback: resolve,
      onerror: () => reject(new Error('Could not start Google Drive Picker. Check that the Google Picker API is enabled.')),
      timeout: 10000,
      ontimeout: () => reject(new Error('Google Drive Picker took too long to load. Please try again.')),
    });
  }));
  return googlePickerModule;
}
async function chooseGoogleDrivePdf() {
  const config = await api('/bills/google-drive/config');
  if (!config.configured) throw new Error('Google Drive is not configured. Ask an administrator to add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_API_KEY.');
  await loadGooglePickerModule();
  if (!window.google?.accounts?.oauth2 || !window.google?.picker) throw new Error('Google Drive is not ready. Please refresh the page and try again.');
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.client_id,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response) => response.error ? reject(new Error(response.error_description || 'Google sign-in was not completed.')) : resolve(response.access_token),
      error_callback: () => reject(new Error('Google sign-in was not completed.')),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
  const picked = await new Promise((resolve, reject) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.PDFS).setIncludeFolders(true);
    const picker = new window.google.picker.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(config.api_key).setOrigin(window.location.protocol + '//' + window.location.host).setCallback((data) => {
      if (data.action === window.google.picker.Action.PICKED) resolve(data.docs[0]);
      if (data.action === window.google.picker.Action.CANCEL) reject(new Error('Google Drive selection was cancelled.'));
    });
    if (config.app_id) picker.setAppId(config.app_id);
    picker.build().setVisible(true);
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(picked.id)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('Google Drive could not download the selected PDF.');
  const blob = await response.blob();
  if (blob.size > 10 * 1024 * 1024) throw new Error('PDF bills must be 10 MB or smaller.');
  return new File([blob], picked.name || 'google-drive-bill.pdf', { type: 'application/pdf' });
}
async function openRazorpayCheckout(order) {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      callback(value);
    };
    const checkout = new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: 'Atmos',
      description: `${order.credits.toLocaleString()} carbon credits`,
      prefill: { name: state.profile.name, email: state.profile.email },
      theme: { color: '#173f35' },
      handler: (payment) => finish(resolve, payment),
      modal: { ondismiss: () => finish(reject, new Error('Payment was cancelled.')) },
    });
    checkout.on('payment.failed', (response) => finish(reject, new Error(response.error?.description || 'Payment failed. Please try again.')));
    checkout.open();
  });
}
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
  return `
    <div class="marketing atmos-new-landing">

      ${marketingHeader()}

      <!-- HERO -->
      <section class="atmos-hero site-container">

        <div class="atmos-hero-copy">

          <div class="atmos-kicker reveal">
            <span class="atmos-kicker-line"></span>
            CARBON INTELLIGENCE FOR OPERATING TEAMS
          </div>

          <h1 class="atmos-hero-title reveal">
            Measure what
            <br>
            your business
            <br>
            <span class="atmos-italic">leaves behind.</span>
          </h1>

          <p class="atmos-hero-description reveal">
            Turn utility bills and operational evidence into a clear
            emissions picture. Track CO₂e, identify hotspots, and
            move from reporting to reduction.
          </p>

          <div class="atmos-hero-buttons reveal">

            <button
              class="pill-button dark large atmos-primary-button"
              data-route="${state.profile ? 'dashboard' : 'register'}"
            >
              ${state.profile ? 'Open workspace' : 'Start measuring'}
              ${icon('arrowUp', 18)}
            </button>

            <a
              class="atmos-secondary-link"
              href="#how-it-works"
            >
              Explore the workflow
              ${icon('arrow', 17)}
            </a>

          </div>

          <div class="atmos-hero-proof reveal">
            ${icon('shield', 19)}
            <div>
              <strong>Evidence-led accounting</strong>
              <span>Every estimate stays connected to its source document.</span>
            </div>
          </div>

        </div>


        <!-- VISUAL GLOBE -->
        <div class="atmos-hero-visual">

          <div class="atmos-globe-scene">

            <div class="atmos-globe-orbit orbit-a"></div>
            <div class="atmos-globe-orbit orbit-b"></div>
            <div class="atmos-globe-orbit orbit-c"></div>

            <div class="atmos-globe">

              <div class="atmos-globe-grid"></div>

              <div class="atmos-globe-land land-one"></div>
              <div class="atmos-globe-land land-two"></div>
              <div class="atmos-globe-land land-three"></div>
              <div class="atmos-globe-land land-four"></div>

              <div class="atmos-globe-shine"></div>

            </div>

            <div class="atmos-globe-dot"></div>

            <div class="atmos-floating-card footprint-card">

              <span class="atmos-card-label">
                ESTIMATED FOOTPRINT
              </span>

              <div class="atmos-footprint-number">
                12.8
                <span>tCO₂e</span>
              </div>

              <div class="atmos-footprint-change">
                <span class="atmos-status-dot"></span>
                18% lower <span>than last period</span>
              </div>

            </div>


            <div class="atmos-floating-card energy-card">

              <div class="atmos-floating-icon">
                ${icon('bolt', 18)}
              </div>

              <span>Electricity</span>

              <strong>48%</strong>

            </div>


            <div class="atmos-floating-card transport-card">

              <div class="atmos-floating-icon">
                ${icon('layers', 18)}
              </div>

              <span>Transport</span>

              <strong>27%</strong>

            </div>


            <div class="atmos-orbit-accent"></div>

          </div>

        </div>

      </section>


      <!-- PROCESS STRIP -->
      <section class="atmos-process-strip">

        <div class="site-container atmos-process-inner">

          <span class="atmos-process-label">
            ONE AUDITABLE WORKFLOW
          </span>

          <div class="atmos-process-item">
            Evidence
          </div>

          <span class="atmos-process-separator">●</span>

          <div class="atmos-process-item">
            Measurement
          </div>

          <span class="atmos-process-separator">●</span>

          <div class="atmos-process-item">
            Reduction
          </div>

          <span class="atmos-process-separator">●</span>

          <div class="atmos-process-item">
            Reporting
          </div>

        </div>

      </section>


      <!-- HOW IT WORKS -->
      <section
        class="atmos-workflow site-container"
        id="how-it-works"
      >

        <div class="atmos-workflow-heading">

          <div class="atmos-workflow-title">

            <div class="atmos-kicker">
              <span class="atmos-kicker-line"></span>
              FROM DOCUMENT TO DECISION
            </div>

            <h2>
              Your footprint,
              <br>
              <span class="atmos-italic">
                without the fog.
              </span>
            </h2>

          </div>

          <p class="atmos-workflow-intro">
            Atmos gives every team a practical path from raw
            operational documents to reduction-ready carbon data.
          </p>

        </div>


        <div class="atmos-workflow-grid">


          <!-- CARD 1 -->
          <article class="atmos-workflow-card">

            <div class="atmos-workflow-top">

              <span class="atmos-workflow-number">
                01
              </span>

              <div class="atmos-workflow-icon atmos-icon-upload">
                ${icon('upload', 25)}
              </div>

            </div>

            <h3>
              Collect
              <br>
              evidence.
            </h3>

            <p>
              Upload electricity, fuel, travel, waste and other
              operational bills into the right department.
            </p>

            <div class="atmos-card-decoration atmos-upload-decoration">

              <div class="atmos-document">
                <div></div>
                <div></div>
                <div></div>
                <div class="short"></div>
              </div>

              <div class="atmos-document document-back">
                <div></div>
                <div></div>
                <div class="short"></div>
              </div>

              <div class="atmos-upload-circle">
                ${icon('upload', 22)}
              </div>

            </div>

            <span class="atmos-card-bottom-label">
              SOURCE DOCUMENTS
            </span>

          </article>


          <!-- CARD 2 -->
          <article class="atmos-workflow-card">

            <div class="atmos-workflow-top">

              <span class="atmos-workflow-number">
                02
              </span>

              <div class="atmos-workflow-icon atmos-icon-measure">
                ${icon('spark', 25)}
              </div>

            </div>

            <h3>
              Calculate
              <br>
              CO₂e.
            </h3>

            <p>
              AI-assisted analysis extracts activity data and
              estimates emissions with visible confidence and
              assumptions.
            </p>

            <div class="atmos-card-decoration atmos-measure-decoration">

              <div class="atmos-measure-ring ring-one"></div>
              <div class="atmos-measure-ring ring-two"></div>
              <div class="atmos-measure-ring ring-three"></div>

              <div class="atmos-measure-center">
                CO₂
              </div>

              <div class="atmos-measure-node node-one"></div>
              <div class="atmos-measure-node node-two"></div>
              <div class="atmos-measure-node node-three"></div>

            </div>

            <span class="atmos-card-bottom-label">
              CARBON INTELLIGENCE
            </span>

          </article>


          <!-- CARD 3 -->
          <article class="atmos-workflow-card">

            <div class="atmos-workflow-top">

              <span class="atmos-workflow-number">
                03
              </span>

              <div class="atmos-workflow-icon atmos-icon-action">
                ${icon('bolt', 25)}
              </div>

            </div>

            <h3>
              Act on
              <br>
              hotspots.
            </h3>

            <p>
              Compare periods, understand category shares, and
              focus reduction work where it has the greatest impact.
            </p>

            <div class="atmos-card-decoration atmos-action-decoration">

              <div class="atmos-action-bars">

                <div class="action-bar bar-one"></div>
                <div class="action-bar bar-two"></div>
                <div class="action-bar bar-three"></div>
                <div class="action-bar bar-four"></div>
                <div class="action-bar bar-five"></div>

              </div>

              <div class="atmos-action-arrow">
                ${icon('arrowUp', 22)}
              </div>

            </div>

            <span class="atmos-card-bottom-label">
              REDUCTION STRATEGY
            </span>

          </article>


        </div>

      </section>


      <!-- WHY ATMOS -->
      <section
        class="atmos-why-section"
        id="why-atmos"
      >

        <div class="site-container atmos-why-inner">

          <div class="atmos-why-copy">

            <div class="atmos-kicker">
              <span class="atmos-kicker-line"></span>
              BUILT FOR CREDIBLE ACTION
            </div>

            <h2>
              Carbon reporting
              <br>
              should create
              <br>
              <span class="atmos-italic">
                momentum,
              </span>
              not
              <br>
              paperwork.
            </h2>

          </div>


          <div class="atmos-why-list">

            <article class="atmos-why-item">

              <span class="atmos-why-number">
                01
              </span>

              <div>
                <h3>Traceable by design</h3>

                <p>
                  Source documents, estimates, and retired credits
                  remain connected.
                </p>
              </div>

            </article>


            <article class="atmos-why-item">

              <span class="atmos-why-number">
                02
              </span>

              <div>
                <h3>Clear across teams</h3>

                <p>
                  Department-level access keeps data ownership
                  simple and accountable.
                </p>
              </div>

            </article>


            <article class="atmos-why-item">

              <span class="atmos-why-number">
                03
              </span>

              <div>
                <h3>Useful beyond compliance</h3>

                <p>
                  Reduction suggestions turn reporting data
                  into practical next steps.
                </p>
              </div>

            </article>

          </div>

        </div>

      </section>


      <!-- CARBON CREDIT STORY -->
      <section class="atmos-offset-section">

        <div class="site-container atmos-offset-inner">

          <div class="atmos-offset-heading">

            <div class="atmos-kicker">
              <span class="atmos-kicker-line"></span>
              ACCOUNT FOR RESIDUAL IMPACT
            </div>

            <h2>
              Measure first.
              <br>
              Reduce next.
              <br>
              <span class="atmos-italic">
                Offset responsibly.
              </span>
            </h2>

          </div>


          <div class="atmos-offset-content">

            <div class="atmos-offset-art">

              <div class="atmos-offset-orbit orbit-one"></div>
              <div class="atmos-offset-orbit orbit-two"></div>

              <div class="atmos-offset-core">
                CO₂
              </div>

              <span class="atmos-offset-particle particle-one">
                CO₂
              </span>

              <span class="atmos-offset-particle particle-two">
                CO₂
              </span>

              <span class="atmos-offset-particle particle-three">
                CO₂
              </span>

            </div>


            <div class="atmos-offset-copy">

              <p>
                Carbon credits are retired against analyzed
                emissions at one credit per tonne of CO₂e.
                Your ledger records every purchase, transfer,
                and retirement.
              </p>

              <button
                class="pill-button dark"
                data-route="${state.profile ? 'purchase' : 'register'}"
              >
                ${state.profile ? 'View your ledger' : 'Explore Atmos'}
                ${icon('arrow', 17)}
              </button>

            </div>

          </div>

        </div>

      </section>


      <!-- PRICING -->
      <section
        class="pricing-section site-container"
        id="pricing"
      >

        <div class="pricing-heading">

          <div>

            <div class="atmos-kicker">
              <span class="atmos-kicker-line"></span>
              SIMPLE BY DESIGN
            </div>

            <h2>
              Choose your scale.
              <br>
              <span class="atmos-italic">
                Keep your impact moving.
              </span>
            </h2>

          </div>

          <p>
            Start with what you need. Every credit pack is designed
            to support your team's carbon accounting workflow.
          </p>

        </div>

        <div class="pricing-grid">

          ${
            Object.entries(state.plans)
              .map(([name, plan], index) => planCard(name, plan, index))
              .join('')
            || '<p>Loading plans…</p>'
          }

          <p class="pricing-disclaimer">
            Purchases currently add demo credits. No payment is collected.
          </p>

        </div>

      </section>


      <!-- FINAL CTA -->
      <section class="atmos-final-cta">

        <div class="site-container atmos-final-inner">

          <div class="atmos-final-star">
            ✳
          </div>

          <div class="atmos-kicker">
            THE NEXT STEP STARTS WITH DATA
          </div>

          <h2>
            Clarity today.
            <br>
            <span class="atmos-italic">
              A lighter tomorrow.
            </span>
          </h2>

          <p>
            Bring your operational data together and make
            carbon reduction a practical part of how your
            organisation works.
          </p>

          <button
            class="pill-button light large"
            data-route="${state.profile ? 'dashboard' : 'register'}"
          >
            ${state.profile ? 'Open your workspace' : 'Create your workspace'}
            ${icon('arrowUp', 18)}
          </button>

        </div>

      </section>


      <!-- FOOTER -->
      <footer class="marketing-footer site-container atmos-footer">

        <a href="#home" data-route="home">
          ${logo()}
        </a>

        <span>
          Measure · Reduce · Report
        </span>

        <span>
          © ${new Date().getFullYear()} Atmos
        </span>

      </footer>

    </div>
  `;
}

function authPageWithDepartment() {
  const register = state.route === 'register';
  return `<div class="auth-layout"><section class="auth-side"><a href="#home" data-route="home">${logo(true)}</a><div class="auth-side-center"><span class="eyebrow-line">CARBON CLARITY, MADE CALM</span><h2>Better decisions<br>begin with <em>perspective.</em></h2><p>A considered workspace for the evidence, teams, and choices that shape your footprint.</p><div class="auth-art"><span class="auth-art-ring"></span><span class="auth-art-star">✳</span><span class="auth-art-small">✦</span></div></div><span class="auth-side-footer">ATMOS · MEASURE · REDUCE · REPORT</span></section><section class="auth-main"><div class="auth-top"><button class="text-action" data-route="home">← Back to home</button><span>${register ? 'Already have an account?' : 'New to Atmos?'} <button class="text-action emphasized" data-route="${register ? 'login' : 'register'}">${register ? 'Log in' : 'Get started'}</button></span></div><div class="auth-form-container"><span class="eyebrow-line"><span class="tiny-star">✳</span> ${register ? 'WELCOME TO ATMOS' : 'WELCOME BACK'}</span><h1>${register ? 'Start with a clearer picture.' : 'Your workspace is ready.'}</h1><p>${register ? 'Create your account, then turn everyday evidence into informed climate action.' : 'Continue measuring, prioritizing, and reporting with confidence.'}</p><form data-form="${register ? 'register' : 'login'}">${register ? field('Your name', 'name', 'text', 'placeholder="Alex Morgan" autocomplete="name" maxlength="255"') + field('Workspace / department name', 'department_name', 'text', 'placeholder="Your team’s name" maxlength="255"') : ''}${field('Work email', 'email', 'email', 'placeholder="you@company.com" autocomplete="username"')}${field('Password', 'password', 'password', `placeholder="${register ? 'At least 8 characters' : 'Your password'}" autocomplete="${register ? 'new-password' : 'current-password'}" ${register ? 'minlength="8" maxlength="128"' : ''}`)}<button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'One moment…' : register ? 'Create my workspace' : 'Log in to my workspace'} ${icon('arrow', 18)}</button></form><div class="auth-footnote">${icon('shield', 16)} Your workspace is yours. We’re glad you’re here.</div></div></section></div>`;
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
  return `<div class="workspace"><aside class="app-sidebar"><a href="#home" data-route="home" class="app-logo">${logo()}</a><span class="nav-title">YOUR WORKSPACE</span><nav aria-label="Workspace navigation">${visibleNav().map(([key, label, symbol]) => `<button data-route="${key}" class="side-link ${state.route === key ? 'active' : ''}">${icon(symbol, 19)}<span>${label}</span>${state.route === key ? '<span class="active-pip"></span>' : ''}</button>`).join('')}</nav><section class="sidebar-journey" aria-label="Carbon workflow progress"><span>YOUR CARBON PATH</span><div class="journey-line"><i></i></div><div><b>01</b><strong>Collect evidence</strong><small>Upload bills and records</small></div><div><b>02</b><strong>Measure impact</strong><small>See your carbon picture</small></div><div><b>03</b><strong>Take action</strong><small>Focus reductions where they count</small></div></section><div class="sidebar-help"><span class="help-icon">✳</span><h3>More room to grow.</h3><p>Your team’s next big thing is just around the corner.</p><button data-route="purchase">Explore credit packs ${icon('arrow', 15)}</button></div><div class="sidebar-profile"><span class="person-avatar">${esc(initials)}</span><span><strong>${esc(state.profile.name)}</strong><small>${roleLabel}</small></span><button data-action="logout" title="Log out" aria-label="Log out" ${state.busy ? 'disabled' : ''}>${icon('logout', 18)}</button></div></aside><div class="app-main"><header class="app-header"><div class="mobile-app-logo">${logo()}</div><div class="header-greeting">YOUR SPACE TO DO MORE <span>✳</span></div><div class="header-tools">${departmentSelect()}<span class="header-avatar">${esc(initials)}</span><button class="header-signout" data-action="logout" ${state.busy ? 'disabled' : ''}>Sign out</button></div></header><div class="app-content">${toast()}${body}</div><nav class="bottom-nav" aria-label="Mobile workspace navigation">${visibleNav().map(([key, label, symbol]) => `<button data-route="${key}" class="${state.route === key ? 'active' : ''}">${icon(symbol, 20)}<span>${label.split(' ')[0]}</span></button>`).join('')}</nav></div>${supportAssistant()}</div>`;
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
  return purchaseWithDepartment()
    .replace('Displayed pack price', 'Amount to pay')
    .replace('New balance', 'New balance after payment')
    .replace('Demo purchase: credits are added immediately. No payment is collected.', 'Secure test payment powered by Razorpay. Credits are added only after verification.')
    .replace('Adding credits…', 'Opening checkout…')
    .replace('Confirm and add credits', state.selectedPlan ? `Pay ${money(state.plans[state.selectedPlan])}` : 'Pay securely');
}
function activity() {
  if (admin() && !state.departments.length) return `${pageHead('WORKSPACE ACTIVITY', 'Your story starts here.', 'Create your first department to start tracking credits.')}<section class="surface-card">${activityRows()}</section>`;
  if (!admin()) return `${pageHead('WORKSPACE ACTIVITY', 'Every move matters.', 'Your admin can view the department’s full credit history.')}<section class="surface-card">${activityRows()}</section>`;
  return `${pageHead('WORKSPACE ACTIVITY', 'Every move matters.', 'A clear view of the credits coming in and going out.')}<div class="activity-summary"><span class="stat-icon violet">${icon('clock', 21)}</span><div><strong>${count(state.transactions.length)} transactions</strong><span>For ${esc(state.balance?.department_name)}</span></div><span class="summary-balance">${count(state.balance?.balance)} credits available</span></div><section class="surface-card activity-card"><div class="card-heading"><div><span class="overline">YOUR CREDIT HISTORY</span><h2>Recent transactions</h2></div></div>${activityRows()}</section>`;
}
const fileSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
function bills() {
  // Load Google resources while this page is visible, leaving the OAuth popup
  // request directly tied to the later button click.
  if (!googlePickerModule) loadGooglePickerModule().catch(() => { googlePickerModule = undefined; });
  const rows = state.billsError ? `<div class="empty-state"><span class="empty-icon">${icon('refresh', 25)}</span><h3>Could not load stored bills.</h3><p>${esc(state.billsError)}</p><button class="subtle-button" data-action="refresh">Try again</button></div>` : state.bills.length ? `<div class="bill-list">${state.bills.map((bill) => `<div class="bill-row"><span class="bill-file-icon">${icon('file', 21)}</span><span class="bill-details"><strong>${esc(bill.filename)}</strong><small>${when(bill.created_at)} · ${fileSize(bill.size_bytes)}</small></span><button class="bill-download" data-action="download-bill" data-bill-id="${bill.id}" data-filename="${esc(bill.filename)}" ${state.busy ? 'disabled' : ''} aria-label="Download ${esc(bill.filename)}">${icon('download', 18)} Download</button></div>`).join('')}</div>` : `<div class="empty-state"><span class="empty-icon">${icon('file', 25)}</span><h3>No bills uploaded yet.</h3><p>Your stored PDF bills will appear here.</p></div>`;
  const upload = `<section class="surface-card bill-upload-card"><span class="overline">ADD SUPPORTING DOCUMENT</span><h2>Upload a bill</h2><p>Select a PDF bill to store securely with this department’s records.</p><form data-form="bill"><label class="file-drop"><input name="file" type="file" accept="application/pdf,.pdf" required><span class="upload-mark">${icon('upload', 24)}</span><strong>Choose a PDF bill</strong><small>PDF only, up to 10 MB</small></label><div class="upload-options"><span>or</span><button class="subtle-button drive-button" type="button" data-action="google-drive" ${state.busy ? 'disabled' : ''}>${icon('drive', 16)} Add from Google Drive</button></div><button class="pill-button dark full-width" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Uploading…' : 'Upload and store bill'} ${icon('arrow', 17)}</button></form></section>`;
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
  return `${pageHead('COMPLIANCE INTELLIGENCE', 'Your emissions, made clear.', 'See where emissions come from, whether they are improving, and what to do next.', `<span class="report-actions"><button class="subtle-button" data-action="download-report" ${state.busy ? 'disabled' : ''}>${icon('download', 16)} Download report</button><button class="pill-button dark" data-action="email-report" ${state.busy ? 'disabled' : ''}>Email report ${icon('arrowUp', 16)}</button><button class="subtle-button" data-action="analyze-emissions" ${actionDisabled ? 'disabled' : ''}>${actionLabel} ${icon('spark', 16)}</button></span>`)}${!data.ai_configured && data.pending_bills ? '<div class="analytics-alert">Azure analysis is not configured. Set <code>AZURE_AI_PROJECT_ENDPOINT</code>, <code>AZURE_AI_API_KEY</code>, and <code>AZURE_AI_MODEL</code> on the backend.</div>' : ''}${total ? `<section class="carbon-explainer"><div><span>WHAT DOES ${carbon(total).toUpperCase()} CO₂e MEAN?</span><strong>About the same climate impact as driving <em>${count(Math.round(total / 0.21))} km</em> in a typical petrol car.</strong></div><div><span>CARBON CREDITS RETIRED</span><strong><em>${count(data.credits_used)} credit${data.credits_used === 1 ? '' : 's'}</em> deducted at 1 credit per tonne CO₂e.</strong></div><p>CO₂e combines carbon dioxide and other greenhouse gases into one comparable number. Combined emissions are rounded up once: 9.50 tonnes uses 10 credits.</p></section>` : ''}<div class="emission-stats"><article><span>ESTIMATED EMISSIONS</span><strong>${carbon(data.total_co2e_kg)} CO₂e</strong><small>Lower is better</small></article><article><span>BILLS INCLUDED</span><strong>${count(data.analyzed_bills)}</strong><small>${count(data.pending_bills)} still waiting</small></article><article><span>BIGGEST EMISSION SOURCE</span><strong>${esc(data.categories[0]?.category || '—')}</strong><small>${data.categories[0] ? `${(Number(data.categories[0].co2e_kg) / Math.max(total, 1) * 100).toFixed(0)}% of your total` : 'No source data yet'}</small></article></div><div class="analytics-grid"><section class="surface-card trend-card"><div class="card-heading"><div><span class="overline">IS IT GETTING BETTER?</span><h2>Emissions each month</h2><p>Measured in kilograms of CO₂ equivalent</p></div></div>${monthlyGraph}</section><section class="surface-card source-card"><div class="card-heading"><div><span class="overline">WHERE TO ACT FIRST</span><h2>What causes your emissions?</h2><p>Each source shown as a share of the total</p></div></div>${categoryGraph}</section></div><div class="analytics-grid lower"><section class="surface-card"><div class="card-heading"><div><span class="overline">REDUCTION PLAYBOOK</span><h2>Recommended next moves</h2></div></div><ol class="reduction-tips">${suggestions}</ol></section><section class="surface-card"><div class="card-heading"><div><span class="overline">HOW WE CALCULATED IT</span><h2>Bill estimates</h2></div></div><div class="emission-records">${records}</div></section></div>`;
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

function carbonLanding() {
  const signedInRoute = state.profile ? 'dashboard' : 'register';
  return `<div class="marketing carbon-marketing">${marketingHeader()}
    <main>
      <section class="carbon-hero site-container">
        <div class="carbon-hero-copy">
          <span class="carbon-kicker"><i></i> Carbon intelligence for operating teams</span>
          <h1>Measure what<br>your business<br><em>leaves behind.</em></h1>
          <p>Turn utility bills and operational evidence into a clear emissions picture. Track CO₂e, identify hotspots, and move from reporting to reduction.</p>
          <div class="hero-actions">
            <button class="pill-button dark large" data-route="${signedInRoute}">${state.profile ? 'Open carbon dashboard' : 'Start measuring'} ${icon('arrowUp', 18)}</button>
            <a class="carbon-text-link" href="#how-it-works">Explore the workflow ${icon('arrow', 17)}</a>
          </div>
          <div class="carbon-proof"><span>${icon('shield', 18)}</span><p><strong>Evidence-led accounting</strong> Every estimate stays connected to its source document.</p></div>
        </div>
        <div class="carbon-hero-visual" aria-label="Interactive carbon globe with floating emissions indicators">
  <div class="three-planet-host" data-three-planet aria-label="Interactive three-dimensional carbon data planet"></div>
  <div class="globe-stage" data-globe-stage tabindex="0" aria-label="A three-dimensional carbon globe showing electricity, transport, operations, and waste emissions">

    <!-- Atmospheric glow -->
    <div class="globe-atmosphere"></div>

    <!-- Orbital rings -->
    <div class="globe-orbit orbit-a">
      <span class="orbit-node"></span>
    </div>

    <div class="globe-orbit orbit-b">
      <span class="orbit-node orbit-node-two"></span>
    </div>

    <div class="globe-orbit orbit-c"></div>

    <div class="globe-orbit orbit-d">
      <span class="orbit-node orbit-node-three"></span>
    </div>

    <!-- Globe -->
    <div class="carbon-globe">

      <div class="globe-shine"></div>

      <div class="globe-land land-one"></div>
      <div class="globe-land land-two"></div>
      <div class="globe-land land-three"></div>

      <div class="globe-grid"></div>

      <div class="globe-3d-highlight"></div>

      <div class="globe-core-mark">✳</div>

    </div>

    <!-- Floating carbon indicators -->
    <div class="co2-bubble bubble-one">
      <span>CO₂</span>
      <small>Electricity</small>
    </div>

    <div class="co2-bubble bubble-two">
      <span>CO₂</span>
      <small>Transport</small>
    </div>

    <div class="co2-bubble bubble-three">
      <span>CO₂</span>
      <small>Operations</small>
    </div>

    <div class="co2-bubble bubble-four">
      <span>CO₂</span>
      <small>Waste</small>
    </div>

    <!-- Carbon dashboard floating card -->
    <div class="carbon-score">
      <span>ESTIMATED FOOTPRINT</span>

      <strong>
        12.8
        <small>t CO₂e</small>
      </strong>

      <div>
        <i></i>
        <b>18% lower</b> than last period
      </div>
    </div>

    <!-- Data chips -->
    <div class="source-chip source-chip-one">
      ${icon('bolt', 16)}
      Electricity
      <b>48%</b>
    </div>

    <div class="source-chip source-chip-two">
      ${icon('cloud', 16)}
      Transport
      <b>27%</b>
    </div>

    <div class="orbit-leaf">
      ${icon('leaf', 34)}
    </div>

    <!-- Small floating data particles -->
    <div class="globe-particle particle-one"></div>
    <div class="globe-particle particle-two"></div>
    <div class="globe-particle particle-three"></div>

  </div>
        </div>
      </section>
      <section class="carbon-metrics"><div class="site-container"><span>ONE AUDITABLE WORKFLOW</span><strong>Evidence</strong><i></i><strong>Measurement</strong><i></i><strong>Reduction</strong><i></i><strong>Reporting</strong></div></section>
      <section class="carbon-signal-strip site-container" aria-label="Atmos platform capabilities">
        <article><span>01</span><div><strong>Source-linked</strong><p>Every carbon estimate stays connected to its underlying operational evidence.</p></div></article>
        <article><span>02</span><div><strong>Review-ready</strong><p>Keep assumptions, category detail, and department context visible to your team.</p></div></article>
        <article><span>03</span><div><strong>Action-focused</strong><p>Move from reporting snapshots to a clear, prioritized reduction path.</p></div></article>
      </section>
     <section id="how-it-works" class="carbon-workflow site-container">

  <div class="workflow-new-heading">
    <div>
      <span class="carbon-kicker">
        <i></i> THE ATMOS SYSTEM
      </span>

      <h2>
        From evidence<br>
        to <em>environmental intelligence.</em>
      </h2>
    </div>

    <p>
      A connected system that transforms everyday operational
      records into measurable emissions, actionable insights
      and informed decisions.
    </p>
  </div>

  <div class="workflow-visual">

    <div class="workflow-rail">
      <div class="workflow-rail-progress"></div>
    </div>

    <div class="workflow-new-grid">

      <!-- STEP 1 -->

      <article class="workflow-new-item">

        <div class="workflow-new-top">
          <span class="workflow-new-number">01</span>
          <span class="workflow-new-label">INPUT</span>
        </div>

        <div class="workflow-new-graphic graphic-documents">

          <div class="doc-back"></div>

          <div class="doc-front">

            <div class="doc-line doc-line-long"></div>
            <div class="doc-line"></div>
            <div class="doc-line doc-line-short"></div>

            <div class="doc-data-row">
              <span></span>
              <b>£1,248.90</b>
            </div>

            <div class="doc-data-row">
              <span></span>
              <b>846 kWh</b>
            </div>

          </div>

          <div class="doc-float-chip">
            <span class="doc-chip-dot"></span>
            DOCUMENT RECEIVED
          </div>

        </div>

        <div class="workflow-new-content">

          <span class="workflow-new-kicker">
            EVIDENCE COLLECTION
          </span>

          <h3>
            Every source.<br>
            Connected.
          </h3>

          <p>
            Bring electricity bills, fuel records and operational
            documents into one organised evidence system.
          </p>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Centralised records</strong>
              <small>Department-organised evidence</small>
            </div>
          </div>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Document validation</strong>
              <small>Reliable inputs for analysis</small>
            </div>
          </div>

        </div>

      </article>


      <!-- STEP 2 -->

      <article class="workflow-new-item">

        <div class="workflow-new-top">
          <span class="workflow-new-number">02</span>
          <span class="workflow-new-label">PROCESS</span>
        </div>

        <div class="workflow-new-graphic graphic-analysis">

          <div class="analysis-ring analysis-ring-one"></div>
          <div class="analysis-ring analysis-ring-two"></div>

          <div class="analysis-core">
            <span>CO₂</span>
            <small>ANALYSIS</small>
          </div>

          <div class="analysis-particle particle-one"></div>
          <div class="analysis-particle particle-two"></div>
          <div class="analysis-particle particle-three"></div>
          <div class="analysis-particle particle-four"></div>

          <div class="analysis-tag tag-electric">
            <span></span> ELECTRICITY
          </div>

          <div class="analysis-tag tag-fuel">
            <span></span> FUEL
          </div>

        </div>

        <div class="workflow-new-content">

          <span class="workflow-new-kicker">
            AI-ASSISTED MEASUREMENT
          </span>

          <h3>
            Raw data.<br>
            Clear numbers.
          </h3>

          <p>
            Extract activity information, calculate emissions
            and make assumptions visible for review.
          </p>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Automated extraction</strong>
              <small>Turn documents into data</small>
            </div>
          </div>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Emission estimation</strong>
              <small>Understand your CO₂e footprint</small>
            </div>
          </div>

        </div>

      </article>


      <!-- STEP 3 -->

      <article class="workflow-new-item">

        <div class="workflow-new-top">
          <span class="workflow-new-number">03</span>
          <span class="workflow-new-label">INSIGHT</span>
        </div>

        <div class="workflow-new-graphic graphic-insights">

          <div class="insight-panel">

            <div class="insight-panel-header">
              <span>EMISSION SOURCES</span>
              <span>↗</span>
            </div>

            <div class="insight-chart">

              <div class="insight-chart-bar bar-one">
                <span>48%</span>
              </div>

              <div class="insight-chart-bar bar-two">
                <span>27%</span>
              </div>

              <div class="insight-chart-bar bar-three">
                <span>16%</span>
              </div>

              <div class="insight-chart-bar bar-four">
                <span>9%</span>
              </div>

            </div>

            <div class="insight-chart-labels">
              <span>ELEC</span>
              <span>FUEL</span>
              <span>TRAVEL</span>
              <span>OTHER</span>
            </div>

          </div>

          <div class="insight-float">
            <span>TOP SOURCE</span>
            <strong>Electricity</strong>
            <small>Needs attention</small>
          </div>

        </div>

        <div class="workflow-new-content">

          <span class="workflow-new-kicker">
            CARBON INTELLIGENCE
          </span>

          <h3>
            See where<br>
            impact lives.
          </h3>

          <p>
            Understand department performance, emission categories,
            trends and the sources driving your footprint.
          </p>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Category breakdowns</strong>
              <small>See your largest sources</small>
            </div>
          </div>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Reporting trends</strong>
              <small>Compare across periods</small>
            </div>
          </div>

        </div>

      </article>


      <!-- STEP 4 -->

      <article class="workflow-new-item">

        <div class="workflow-new-top">
          <span class="workflow-new-number">04</span>
          <span class="workflow-new-label">ACTION</span>
        </div>

        <div class="workflow-new-graphic graphic-action">

          <div class="action-target target-outer"></div>
          <div class="action-target target-middle"></div>
          <div class="action-target target-inner"></div>

          <div class="action-arrow">
            <svg viewBox="0 0 120 120" fill="none">
              <path
                d="M24 88L92 28M55 28H92V65"
                stroke="currentColor"
                stroke-width="5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>

          <div class="action-chip">
            <span></span>
            REDUCTION PRIORITY
          </div>

        </div>

        <div class="workflow-new-content">

          <span class="workflow-new-kicker">
            REDUCTION & REPORTING
          </span>

          <h3>
            Insight into<br>
            action.
          </h3>

          <p>
            Identify hotspots, prioritise reduction opportunities
            and track progress with evidence behind every decision.
          </p>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Action priorities</strong>
              <small>Focus where it matters</small>
            </div>
          </div>

          <div class="workflow-new-feature">
            <span class="workflow-feature-mark">+</span>
            <div>
              <strong>Evidence-led reporting</strong>
              <small>Track measurable progress</small>
            </div>
          </div>

        </div>

      </article>

    </div>

  </div>

  <div class="workflow-new-bottom">

    <div class="workflow-bottom-left">
      <span class="workflow-bottom-symbol">✳</span>

      <div>
        <strong>Measure with clarity.</strong>
        <p>Move forward with evidence, not guesswork.</p>
      </div>
    </div>

    <a href="#why-atmos">
      Discover Atmos <span>↗</span>
    </a>

  </div>

</section>      <section id="why-atmos" class="carbon-manifesto"><div class="site-container manifesto-inner"><div><span class="carbon-kicker light"><i></i> Built for credible action</span><h2>Carbon reporting should create <em>momentum,</em> not paperwork.</h2></div><div class="manifesto-points"><p><b>01</b><span><strong>Traceable by design</strong>Source documents, estimates, and retired credits remain connected.</span></p><p><b>02</b><span><strong>Clear across teams</strong>Department-level access keeps data ownership simple and accountable.</span></p><p><b>03</b><span><strong>Useful beyond compliance</strong>Reduction suggestions turn reporting data into practical next steps.</span></p></div></div></section>
      <section id="pricing" class="carbon-credits-section site-container">
  <div class="credits-editorial">
    <span class="carbon-kicker">
      <i></i> ACCOUNT FOR RESIDUAL IMPACT
    </span>

    <h2>
      Measure first.<br>
      Reduce next.<br>
      <em>Offset responsibly.</em>
    </h2>

    <p>Reduction comes first. When emissions remain, transparent carbon-credit accounting helps you document the next step with confidence.</p>
    <div class="credits-principles"><span><b>01</b> Measure the baseline</span><span><b>02</b> Reduce what you control</span><span><b>03</b> Account for the remainder</span></div>

    <button class="pill-button dark" data-route="${signedInRoute}">
      ${state.profile ? 'View your ledger' : 'Create your workspace'}
      ${icon('arrow', 17)}
    </button>
  </div>

  <div class="credits-visual-panel">
    <div class="credits-visual-orbit credits-orbit-one"></div>
    <div class="credits-visual-orbit credits-orbit-two"></div>

    <div class="credits-visual-main">
      <div class="credits-visual-glow"></div>

      <div class="credits-visual-core">
        <span class="credits-core-top">ATMOS</span>
        <strong>CO₂e</strong>
        <span class="credits-core-bottom">ACCOUNTABILITY</span>
      </div>

      <div class="credits-mini-card credits-mini-top">
        <span class="credits-mini-dot"></span>
        <div>
          <small>PRIORITY</small>
          <strong>Reduce first</strong>
        </div>
      </div>

      <div class="credits-mini-card credits-mini-bottom">
        <span class="credits-mini-dot"></span>
        <div>
          <small>REMAINING IMPACT</small>
          <strong>Account responsibly</strong>
        </div>
      </div>

      <span class="credits-star credits-star-one">✳</span>
      <span class="credits-star credits-star-two">✦</span>
      <span class="credits-star credits-star-three">✳</span>
    </div>
  </div>
</section>
    </main>
<footer class="carbon-footer carbon-footer-enhanced">
  <div class="footer-top">

    <div class="footer-brand-block">
      <a href="#home" data-route="home">
        ${logo()}
      </a>

      <p>
        Clarity for your footprint.<br>
        Confidence for your next move.
      </p>
    </div>

    <div class="footer-navigation">

      <div class="footer-column">
        <span>EXPLORE</span>
        <a href="#how-it-works">How it works</a>
        <a href="#why-atmos">Why Atmos</a>
        <a href="#pricing">Carbon accounting</a>
      </div>

      <div class="footer-column">
        <span>YOUR WORKSPACE</span>
        <button data-route="login">Log in</button>
        <button data-route="register">Get started</button>
      </div>

    </div>

    <div class="footer-message">
      <span class="footer-message-label">
        A SMALLER FOOTPRINT.
      </span>

      <h3>
        Better decisions.<br>
        <em>Better tomorrow.</em>
      </h3>

      <p>Make each reporting cycle more useful than the last.</p>

      <button class="footer-message-action" data-route="${signedInRoute}">${state.profile ? 'Open workspace' : 'Start measuring'} ${icon('arrowUp', 15)}</button>

      <span class="footer-message-mark">✳</span>
    </div>

  </div>

  <div class="footer-bottom">
    <a href="#home" data-route="home">
      ${logo()}
    </a>

    <span>
      © ${new Date().getFullYear()} Atmos
    </span>

    <span class="footer-bottom-note">
      MEASURE · REDUCE · REPORT
    </span>
    <span class="footer-legal-links"><button data-route="privacy">Privacy</button><button data-route="terms">Terms</button></span>
  </div>
</footer>
<div class="landing-leaf-cascade" aria-hidden="true">
  <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
  <b class="leaf-bed"></b>
</div>
  </div>`;
}

function carbonAuth() {
  return authPage()
    .replace('A LITTLE SPACE TO DO A LOT', 'A CLEARER VIEW OF YOUR IMPACT')
    .replace('Good things<br>start <em>together.</em>', 'Climate action<br>starts with <em>clarity.</em>')
    .replace('One place for your people and your possibilities.', 'One evidence-led workspace for your carbon data, teams, and targets.')
    .replace('ATMOS · MADE FOR MOMENTUM', 'ATMOS · MEASURE · REDUCE · REPORT')
    .replace('Let’s build something great.', 'Start measuring your impact.')
    .replace('Good to have you back.', 'Return to your carbon picture.')
    .replace('Pick up right where you left off.', 'Your emissions records and reduction insights are ready.')
    .replace('Create your account. Add your first department whenever you’re ready.', 'Create your account, then organize carbon evidence by department.');
}

function carbonDashboard() {
  if (admin() && !state.departments.length) return dashboard();
  const data = state.emissions || { total_co2e_kg: 0, analyzed_bills: 0, pending_bills: 0, credits_used: 0, categories: [], monthly: [] };
  const total = Number(data.total_co2e_kg || 0);
  const leading = data.categories?.[0];
  const latest = data.monthly?.at(-1);
  const previous = data.monthly?.at(-2);
  const change = previous?.co2e_kg ? ((Number(latest?.co2e_kg || 0) - Number(previous.co2e_kg)) / Number(previous.co2e_kg)) * 100 : null;
  const trendClass = change !== null && change > 0 ? 'rising' : 'falling';
  return `${pageHead('CARBON PERFORMANCE', `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${esc(state.profile.name.split(' ')[0])}.`, 'Your operational carbon picture, from evidence to action.', `<button class="subtle-button" data-action="refresh" ${state.busy ? 'disabled' : ''}>${icon('refresh', 16)} Refresh data</button>`)}
    <section class="carbon-dashboard-hero">
      <div class="dashboard-footprint"><span><i></i> TOTAL MEASURED FOOTPRINT</span><strong>${carbon(total)}<small>CO₂e</small></strong><p>${data.analyzed_bills ? `Calculated from ${count(data.analyzed_bills)} analyzed source document${data.analyzed_bills === 1 ? '' : 's'}.` : 'Upload evidence to establish your emissions baseline.'}</p><button class="pill-button light" data-route="emissions">Open emissions analysis ${icon('arrow', 17)}</button></div>
      <div class="dashboard-signal"><span>PERIOD SIGNAL</span><div class="signal-mark ${trendClass}">${icon(change !== null && change > 0 ? 'arrowUp' : 'leaf', 30)}</div><strong>${change === null ? 'Baseline forming' : `${Math.abs(change).toFixed(0)}% ${change <= 0 ? 'decrease' : 'increase'}`}</strong><p>${change === null ? 'A second reporting period will reveal your direction of travel.' : `Compared with your previous reporting period.`}</p></div>
      <div class="dashboard-rings" aria-hidden="true">
        <span class="ring-one"></span><span class="ring-two"></span><span class="ring-three"></span>
        <div class="dashboard-planet">
          <i class="planet-gridline gridline-one"></i><i class="planet-gridline gridline-two"></i>
          <i class="planet-continent continent-one"></i><i class="planet-continent continent-two"></i>
          <span class="planet-glint"></span>
          <span class="planet-leaf">${icon('leaf', 28)}</span>
        </div>
        <div class="orbit-pod pod-one"><i></i><span>LIVE</span></div>
        <div class="orbit-pod pod-two"><b>CO₂</b><span>tracked</span></div>
        <span class="ring-core">${icon('leaf', 28)}</span>
        <p class="dashboard-visual-caption">Evidence becomes<br><strong>climate clarity.</strong></p>
      </div>
    </section>
    <div class="carbon-stat-grid"><article><span class="stat-number">01</span><p>Largest source</p><strong>${esc(leading?.category || 'No data yet')}</strong><small>${leading && total ? `${(Number(leading.co2e_kg) / total * 100).toFixed(0)}% of measured emissions` : 'Analyze evidence to identify hotspots'}</small></article><article><span class="stat-number">02</span><p>Evidence status</p><strong>${count(data.analyzed_bills)} analyzed</strong><small>${count(data.pending_bills)} document${data.pending_bills === 1 ? '' : 's'} waiting</small></article><article><span class="stat-number">03</span><p>Carbon accounting</p><strong>${count(data.credits_used)} retired</strong><small>${count(state.balance?.balance)} credits available</small></article></div>
    <div class="dashboard-columns carbon-dashboard-columns"><section class="surface-card carbon-action-card"><div class="card-heading"><div><span class="overline">NEXT BEST ACTIONS</span><h2>Keep your inventory moving</h2></div></div><button data-route="bills"><span class="action-number">01</span><span>${icon('upload', 19)}<b>Upload source evidence</b><small>Add a utility or operational PDF</small></span>${icon('chevron', 17)}</button><button data-route="emissions"><span class="action-number">02</span><span>${icon('cloud', 19)}<b>Review emissions</b><small>Explore sources, trends, and recommendations</small></span>${icon('chevron', 17)}</button>${admin() ? `<button data-route="purchase"><span class="action-number">03</span><span>${icon('leaf', 19)}<b>Manage carbon credits</b><small>Maintain cover for residual emissions</small></span>${icon('chevron', 17)}</button>` : ''}</section><section class="surface-card carbon-ledger-card"><div class="card-heading"><div><span class="overline">CARBON CREDIT LEDGER</span><h2>Recent accounting activity</h2></div><button data-route="activity">View all</button></div>${admin() ? activityRows(3) : '<div class="empty-state"><p>Your administrator manages the department credit ledger.</p></div>'}</section></div>`;
}

function aiCfoLanding() {
  return `<div class="ai-cfo-launch">
    <header class="ai-cfo-header"><div class="ai-cfo-wordmark"><i>✦</i> AI CFO</div><span>PRIVATE PREVIEW · COMING SOON</span><div class="ai-cfo-status"><i></i> Building quietly</div></header>
    <main class="ai-cfo-main">
      <div class="ai-cfo-copy"><span class="ai-cfo-kicker">✦ FINANCIAL INTELLIGENCE, REIMAGINED</span><h1>Know what your<br><em>money is telling you.</em></h1><p>A new financial copilot for operating teams—turning cash, spend, and runway into one sharp weekly point of view.</p><div class="ai-cfo-actions"><span class="ai-cfo-coming-soon">Coming soon</span><span>Early access opens shortly</span></div></div>
      <section class="ai-cfo-preview" aria-label="AI CFO preview"><div class="ai-cfo-preview-top"><span>AI CFO / WEEKLY BRIEF</span><i></i><b>LIVE PREVIEW</b></div><div class="ai-cfo-number"><span>Available runway</span><strong>14.2 <small>months</small></strong><p>Up 1.8 months from last quarter</p></div><div class="ai-cfo-bars"><span style="--bar:78%"></span><span style="--bar:56%"></span><span style="--bar:88%"></span><span style="--bar:66%"></span><span style="--bar:92%"></span><span style="--bar:74%"></span></div><div class="ai-cfo-insight"><span>${icon('spark', 20)}</span><p><b>One useful signal</b>Your supplier costs are rising faster than revenue. Review the top three renewals this month.</p></div></section>
    </main>
    <footer>AI CFO · FINANCIAL CLARITY FOR THE NEXT DECISION</footer>
  </div>`;
}

function legalPage(type) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy, made clear.' : 'Terms for using Atmos.';
  const intro = isPrivacy
    ? 'How Atmos handles the information you provide while measuring, reporting, and reducing your organisation’s carbon impact.'
    : 'The straightforward terms that apply when you access and use the Atmos carbon-intelligence workspace.';
  const sections = isPrivacy ? [
    ['Information we collect', 'We collect account information such as your name, work email address, password hash, department details, and the information you choose to upload or enter in the workspace, including bills and carbon-accounting records.'],
    ['How we use it', 'We use this information to provide the Atmos workspace, maintain department access, generate reports, process requested credit activity, improve reliability, and send operational communications when configured.'],
    ['Documents and analysis', 'Bills and supporting documents remain associated with the department that uploaded them. When you request analysis, relevant document text may be sent to the configured analysis provider solely to produce the requested carbon estimate.'],
    ['Sharing and security', 'We do not sell personal information. We share data only with service providers needed to operate enabled features, such as hosting, email delivery, payments, Google Drive imports, and AI analysis. We use reasonable technical and organisational safeguards, but no online service is completely secure.'],
    ['Your choices', 'You may ask to access, correct, or delete your account information by contacting the workspace administrator or the Atmos team. Your organisation is responsible for ensuring it has the right to upload and manage its workspace data.'],
  ] : [
    ['Using the service', 'You may use Atmos only for lawful business purposes and in accordance with your organisation’s authority. Keep account credentials confidential and notify us promptly of any suspected unauthorised access.'],
    ['Your data', 'You retain responsibility for the information and documents you upload. You confirm that you have the necessary rights to submit them and that they do not violate applicable law or another party’s rights.'],
    ['Carbon estimates', 'Atmos outputs are decision-support estimates based on available evidence, assumptions, and configured analysis services. They are not legal, financial, audit, tax, or formal compliance advice, and should be independently reviewed before external reporting or material decisions.'],
    ['Third-party services', 'Optional features may rely on third parties including payment providers, email services, Google Drive, and AI analysis providers. Your use of those features is also subject to the relevant provider terms and privacy notices.'],
    ['Changes and contact', 'We may update these terms as Atmos evolves. Continuing to use the service after an update means you accept the revised terms. For questions about these terms, contact the Atmos workspace administrator.'],
  ];
  return `<main class="legal-page"><header class="legal-header"><a href="#home" data-route="home">${logo()}</a><nav><button data-route="privacy" class="${isPrivacy ? 'active' : ''}">Privacy</button><button data-route="terms" class="${!isPrivacy ? 'active' : ''}">Terms</button><button data-route="home">Back to home ${icon('arrowUp', 15)}</button></nav></header><article class="legal-content"><span class="legal-kicker">ATMOS · ${isPrivacy ? 'PRIVACY POLICY' : 'TERMS OF SERVICE'}</span><h1>${title}</h1><p class="legal-lead">${intro}</p><p class="legal-date">Last updated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>${sections.map(([heading, text], index) => `<section><span>0${index + 1}</span><div><h2>${heading}</h2><p>${text}</p></div></section>`).join('')}<footer><p>Questions about ${isPrivacy ? 'privacy' : 'these terms'}?</p><a href="mailto:support@atmos.example">Contact Atmos support ${icon('arrowUp', 15)}</a></footer></article></main>`;
}

function carbonShell(body) {
  const launchGift = `<button class="ai-cfo-gift" data-route="ai-cfo" aria-label="Discover the new AI CFO project"><span class="ai-cfo-gift-badge">NEW</span>${icon('gift', 21)}<span class="ai-cfo-gift-tooltip">Meet AI CFO</span></button>`;
  return shell(`${body}${launchGift}`)
    .replace('YOUR WORKSPACE', 'CARBON WORKSPACE')
    .replace('More room to grow.', 'Build a lower-carbon future.')
    .replace('Your team’s next big thing is just around the corner.', 'Measure first, then focus every reduction where it counts.')
    .replace('Explore credit packs', 'Manage carbon credits')
    .replace('YOUR SPACE TO DO MORE', 'MEASURE · REDUCE · REPORT');
}

function render() {
  if (state.loading) { app.innerHTML = '<div class="loading-screen">✳ <span>atmos.</span></div>'; return; }
  if (nav.some(([key]) => key === state.route) && !state.profile) { navigate('login'); return; }
  if (dataOfficer() && nav.some(([key]) => key === state.route) && state.route !== 'bills') { navigate('bills'); return; }
  const content = {
    home: carbonLanding,
    'ai-cfo': aiCfoLanding,
    privacy: () => legalPage('privacy'),
    terms: () => legalPage('terms'),
    login: carbonAuth,
    register: carbonAuth,
    dashboard: carbonDashboard,
    purchase,
    bills: admin() || dataOfficer() ? bills : dashboard,
    emissions: admin() || complianceManager() ? emissions : dashboard,
    activity,
    team: admin() ? team : dashboard,
    departments: admin() ? departments : dashboard,
  }[state.route]();
  app.innerHTML = state.profile && !['home', 'login', 'register', 'ai-cfo', 'privacy', 'terms'].includes(state.route) ? carbonShell(content) : `${content}${toast()}`;
   enhanceMotion(app);
   if (state.route === 'home') {

  const revealItems = app.querySelectorAll(
    '.carbon-hero-copy, ' +
    '.carbon-hero-visual, ' +
    '.carbon-metrics, ' +
    '.carbon-workflow, ' +
    '.workflow-new-heading, ' +
    '.workflow-new-item, ' +
    '.workflow-new-bottom, ' +
    '.carbon-manifesto, ' +
    '.manifesto-points p, ' +
    '.carbon-credits-section, ' +
    '.carbon-footer'
  );

  revealItems.forEach((el, index) => {

    el.classList.add('scroll-reveal');

    el.style.setProperty(
      '--reveal-delay',
      `${Math.min(index % 4, 3) * 100}ms`
    );

  });

  if ('IntersectionObserver' in window) {

    const observer = new IntersectionObserver(

      entries => {

        entries.forEach(entry => {

          if (entry.isIntersecting) {

            entry.target.classList.add('is-visible');

            observer.unobserve(entry.target);

          }

        });

      },

      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      }

    );

    revealItems.forEach(el => observer.observe(el));

   } else {

    revealItems.forEach(el => el.classList.add('is-visible'));

   }

  const threePlanet = app.querySelector('[data-three-planet]');
  mountThreePlanet(threePlanet, { paused: false });
  const globeStage = app.querySelector('[data-globe-stage]');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (globeStage && !reducedMotion) {
    const setGlobeTilt = (event) => {
      const bounds = globeStage.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - .5) * 2;
      globeStage.style.setProperty('--globe-tilt-x', `${(-y * 5).toFixed(2)}deg`);
      globeStage.style.setProperty('--globe-tilt-y', `${(x * 7).toFixed(2)}deg`);
      globeStage.classList.add('is-tilting');
    };
    globeStage.addEventListener('pointermove', setGlobeTilt);
    globeStage.addEventListener('pointerleave', () => {
      globeStage.style.removeProperty('--globe-tilt-x');
      globeStage.style.removeProperty('--globe-tilt-y');
      globeStage.classList.remove('is-tilting');
    });
  }

}
  if (complianceManager()) app.querySelector('.sidebar-help button')?.remove();
  const source = app.querySelector('[name="from_department_id"]');
  const destination = app.querySelector('[name="to_department_id"]');
  if (source && destination && source.value === destination.value) {
    destination.value = [...destination.options].find((option) => option.value !== source.value)?.value ?? '';
  }
  document.title = state.route === 'home' ? 'Atmos — Carbon intelligence' : state.route === 'ai-cfo' ? 'AI CFO · Atmos' : `${state.route[0].toUpperCase() + state.route.slice(1)} · Atmos`;
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
  if (target.dataset.action === 'close-support') state.supportOpen = false;
  if (target.dataset.route) { event.preventDefault(); navigate(target.dataset.route); }
  if (target.dataset.selectPlan) { state.selectedPlan = target.dataset.selectPlan; render(); }
   if (target.dataset.action === 'menu') { state.mobileMenu = !state.mobileMenu; render(); }
  if (target.dataset.action === 'dismiss') { state.notice = null; render(); }
  if (target.dataset.action === 'toggle-support') { state.supportOpen = !state.supportOpen; render(); }
  if (target.dataset.action === 'support-suggest') {
    state.supportDraft = target.dataset.question || '';
    const input = app.querySelector('[data-support-input]');
    if (input) { input.value = state.supportDraft; input.focus(); }
  }
  if (target.dataset.action === 'support-send') {
    const input = app.querySelector('[data-support-input]');
    const message = (input?.value || state.supportDraft).trim();
    if (!message || state.supportBusy) return;
    state.supportMessages.push({ from: 'user', text: message });
    state.supportDraft = '';
    state.supportBusy = true;
    render();
    api('/support/chat', { method: 'POST', body: { message } })
      .then((reply) => { state.supportMessages.push({ from: 'assistant', text: reply.answer, route: reply.route, actionLabel: reply.action_label }); })
      .catch((error) => { state.supportMessages.push({ from: 'assistant', text: error.message }); })
      .finally(() => { state.supportBusy = false; render(); });
  }
  if (target.dataset.action === 'reload-plans') { void loadPlans(); render(); }
  if (target.dataset.action === 'close-modal' && (target === event.target || target.classList.contains('modal-close'))) { state.selectedPlan = null; render(); }
  if (target.dataset.action === 'refresh') execute(async () => { state.plans = await api('/credits/plans', { token: '' }); await refresh(); }, 'Your workspace is up to date.');
  if (target.dataset.action === 'logout') execute(async () => { await api('/auth/logout', { method: 'POST' }); clearSession(); navigate('home'); }, 'You’re signed out. See you soon!');
  if (target.dataset.action === 'confirm-purchase') execute(async () => {
    const order = await api('/admin/credits/purchases', { method: 'POST', body: { plan: state.selectedPlan, department_id: Number(state.department) } });
    const payment = await openRazorpayCheckout(order);
    await api('/admin/credits/purchases/verify', { method: 'POST', body: payment });
    await refresh();
    navigate('dashboard');
  }, 'Payment verified and credits added.');
  if (target.dataset.action === 'download-bill') execute(async () => {
    const blob = await api(`/bills/${encodeURIComponent(target.dataset.billId)}/file`, { responseType: 'blob', timeout: 120000 });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = target.dataset.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  if (target.dataset.action === 'google-drive') execute(async () => {
    const file = await chooseGoogleDrivePdf();
    const body = new FormData();
    body.append('file', file);
    if (admin()) body.append('department_id', state.department);
    await api('/bills', { method: 'POST', body });
    await refresh();
  }, 'Your Google Drive PDF has been stored.');
  if (target.dataset.action === 'download-report') execute(async () => {
    const query = admin() ? `?department_id=${encodeURIComponent(state.department)}` : '';
    const reportBlob = await api(`/reports/download${query}`, { responseType: 'blob', timeout: 120000 });
    const url = URL.createObjectURL(reportBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'atmos-department-report.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'Your department report has downloaded.');
  if (target.dataset.action === 'email-report') execute(async () => {
    const query = admin() ? `?department_id=${encodeURIComponent(state.department)}` : '';
    await api(`/reports/email${query}`, { method: 'POST', timeout: 120000 });
  }, 'Your report has been emailed with its PDF attachment.');
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
app.addEventListener('input', (event) => {
  if (event.target.matches('[data-support-input]')) state.supportDraft = event.target.value;
});
app.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !event.target.matches('[data-support-input]')) return;
  event.preventDefault();
  app.querySelector('[data-action="support-send"]')?.click();
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
