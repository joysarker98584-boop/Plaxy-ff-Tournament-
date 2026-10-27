console.log('ArenaX app booted');

const page = document.body.dataset.page;
const apiBase = '/api';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

function formatMoney(value) {
  return `৳${Number(value || 0).toLocaleString('en-BD')}`;
}

function getUserFromStorage() {
  const raw = localStorage.getItem('arenax_user');
  return raw ? JSON.parse(raw) : null;
}

function setUserInStorage(user) {
  if (!user) {
    localStorage.removeItem('arenax_user');
    return;
  }
  localStorage.setItem('arenax_user', JSON.stringify(user));
}

async function loadCurrentUser() {
  try {
    const response = await requestJson(`${apiBase}/me`);
    setUserInStorage(response.user);
    return response.user;
  } catch (error) {
    setUserInStorage(null);
    return null;
  }
}

function updateAuthUi(user) {
  const authLinks = document.querySelectorAll('[data-auth-link]');
  const profileButtons = document.querySelectorAll('[data-user-name]');
  authLinks.forEach((el) => {
    el.textContent = user ? 'Dashboard' : 'Login';
    el.setAttribute('href', user ? '/dashboard.html' : '/login.html');
  });
  profileButtons.forEach((button) => {
    if (user) button.textContent = `Hi, ${user.name.split(' ')[0]}`;
  });

  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.style.display = user ? 'inline-flex' : 'none';
    logoutButton.onclick = async () => {
      try {
        await requestJson(`${apiBase}/auth/logout`, { method: 'POST' });
      } catch (error) {
        console.warn(error);
      }
      setUserInStorage(null);
      window.location.href = '/login.html';
    };
  }
}

async function initHeader() {
  const user = getUserFromStorage() || await loadCurrentUser();
  updateAuthUi(user);
}

async function renderTournamentList() {
  const container = document.getElementById('tournament-list');
  if (!container) return;

  try {
    const response = await requestJson(`${apiBase}/tournaments`);
    const tournaments = response.tournaments || [];
    container.innerHTML = tournaments.map((tournament) => `
      <article class="card tournament-card">
        <div class="card-image" style="background-image:url('${tournament.banner}')"></div>
        <div class="card-body">
          <div class="meta-row">
            <span class="pill purple">${tournament.mode}</span>
            <span class="pill green">${tournament.status}</span>
          </div>
          <h3>${tournament.name}</h3>
          <div class="price-row">
            <span>Entry fee</span>
            <strong>${formatMoney(tournament.entryFee)}</strong>
          </div>
          <div class="price-row">
            <span>Prize pool</span>
            <strong>${formatMoney(tournament.prizePool)}</strong>
          </div>
          <div class="info-stack">
            <div class="info-row"><span>Slots</span><span>${tournament.registeredCount}/${tournament.slots}</span></div>
            <div class="info-row"><span>Starts</span><span>${new Date(tournament.startDate).toLocaleDateString()}</span></div>
          </div>
          <div class="hero-actions" style="margin-top:16px;">
            <a class="button primary" href="/tournaments.html">View</a>
            <button class="button secondary" data-register="${tournament.id}">Register</button>
          </div>
        </div>
      </article>
    `).join('');

    document.querySelectorAll('[data-register]').forEach((button) => {
      button.addEventListener('click', async () => {
        const user = getUserFromStorage() || await loadCurrentUser();
        if (!user) {
          window.location.href = '/login.html';
          return;
        }

        try {
          const result = await requestJson(`${apiBase}/tournaments/${button.dataset.register}/register`, { method: 'POST' });
          alert(result.message || 'Registered successfully.');
          await renderTournamentList();
        } catch (error) {
          alert(error.message);
        }
      });
    });
  } catch (error) {
    container.innerHTML = `<div class="panel"><p>${error.message}</p></div>`;
  }
}

async function renderWalletSummary() {
  const walletEl = document.getElementById('wallet-summary');
  if (!walletEl) return;

  try {
    const response = await requestJson(`${apiBase}/wallet/summary`);
    const wallet = response.wallet;
    walletEl.innerHTML = `
      <div class="summary-metric"><strong>${formatMoney(wallet.balance)}</strong><span>Available balance</span></div>
      <div class="summary-metric"><strong>${formatMoney(wallet.pending)}</strong><span>Pending</span></div>
      <div class="summary-metric"><strong>${formatMoney(wallet.totalAdded)}</strong><span>Total added</span></div>
      <div class="summary-metric"><strong>${formatMoney(wallet.totalSpent)}</strong><span>Total spent</span></div>
    `;

    const list = document.getElementById('wallet-transactions');
    if (list) {
      list.innerHTML = (response.ledger || []).slice(0, 6).map((entry) => `
        <div class="panel" style="padding:14px 16px; margin-bottom:10px;">
          <div class="info-row"><span>${entry.type}</span><strong>${entry.direction === 'credit' ? '+' : '-'}${formatMoney(entry.amount)}</strong></div>
          <div class="muted">${entry.status} • ${new Date(entry.createdAt).toLocaleString()}</div>
        </div>
      `).join('');
    }
  } catch (error) {
    walletEl.innerHTML = `<div class="panel"><p>${error.message}</p></div>`;
  }
}

async function renderAdminSummary() {
  const panel = document.getElementById('admin-summary');
  if (!panel) return;

  try {
    const response = await requestJson(`${apiBase}/admin/summary`);
    const totals = response.totals;
    panel.innerHTML = `
      <div class="wallet-box">
        <div class="summary-metric"><strong>${totals.totalUsers}</strong><span>Registered users</span></div>
        <div class="summary-metric"><strong>${totals.tournamentCount}</strong><span>Tournaments</span></div>
        <div class="summary-metric"><strong>${totals.pendingAddMoney}</strong><span>Pending deposits</span></div>
        <div class="summary-metric"><strong>${totals.pendingWithdraws}</strong><span>Pending payouts</span></div>
      </div>
    `;

    const requestList = document.getElementById('admin-requests');
    if (requestList) {
      const list = response.pendingAddMoney.concat(response.pendingWithdraws);
      requestList.innerHTML = list.map((item) => `
        <div class="panel" style="padding:14px 16px; margin-bottom:10px;">
          <div class="info-row"><span>${item.type}</span><strong>${formatMoney(item.amount)}</strong></div>
          <div class="muted">Status: ${item.status} • ${new Date(item.createdAt).toLocaleString()}</div>
          <div class="hero-actions" style="margin-top:10px;">
            <button class="button primary" data-approve-request="${item.id}" data-kind="${item.type}">Approve</button>
          </div>
        </div>
      `).join('');

      requestList.querySelectorAll('[data-approve-request]').forEach((button) => {
        button.addEventListener('click', async () => {
          const kind = button.dataset.kind;
          const route = kind === 'add_money' ? `${apiBase}/admin/approve-money/${button.dataset.approveRequest}` : `${apiBase}/admin/approve-withdraw/${button.dataset.approveRequest}`;
          try {
            const result = await requestJson(route, { method: 'POST' });
            alert(result.message);
            await renderAdminSummary();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    }
  } catch (error) {
    panel.innerHTML = `<div class="panel"><p>${error.message}</p></div>`;
  }
}

async function loginOrRegisterMode() {
  const form = document.getElementById('auth-form');
  if (!form) return;

  const isRegister = document.body.dataset.authMode === 'register';
  const title = document.getElementById('auth-title');
  if (title) title.textContent = isRegister ? 'Create ArenaX account' : 'Welcome back';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById('name')?.value || '',
      email: document.getElementById('email')?.value || '',
      uid: document.getElementById('uid')?.value || '',
      password: document.getElementById('password')?.value || '',
    };

    try {
      const endpoint = isRegister ? `${apiBase}/auth/register` : `${apiBase}/auth/login`;
      const result = await requestJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUserInStorage(result.user);
      window.location.href = '/dashboard.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

async function setupWalletActions() {
  const addMoneyForm = document.getElementById('add-money-form');
  if (addMoneyForm) {
    addMoneyForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        amount: Number(document.getElementById('deposit-amount')?.value || 0),
        method: document.getElementById('deposit-method')?.value || 'bKash',
        reference: document.getElementById('deposit-ref')?.value || '',
        note: 'Manual add money request',
      };

      try {
        const result = await requestJson(`${apiBase}/wallet/add-money`, { method: 'POST', body: JSON.stringify(payload) });
        alert(result.message);
        await renderWalletSummary();
        addMoneyForm.reset();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const withdrawForm = document.getElementById('withdraw-form');
  if (withdrawForm) {
    withdrawForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        amount: Number(document.getElementById('withdraw-amount')?.value || 0),
        method: document.getElementById('withdraw-method')?.value || 'bKash',
        recipient: document.getElementById('withdraw-number')?.value || '',
      };

      try {
        const result = await requestJson(`${apiBase}/wallet/withdraw`, { method: 'POST', body: JSON.stringify(payload) });
        alert(result.message);
        await renderWalletSummary();
        withdrawForm.reset();
      } catch (error) {
        alert(error.message);
      }
    });
  }
}

async function initPage() {
  await initHeader();
  renderTournamentList();
  renderWalletSummary();
  renderAdminSummary();
  loginOrRegisterMode();
  setupWalletActions();
}

initPage();
