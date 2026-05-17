console.info('home.js loaded');
let currentBalance = 0;
let currentGoal = 0;
let currentBudget = 0;
let dailySpent = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

const days = ['sun', 'mon', 'teu', 'wed', 'thu', 'fri', 'sat'];

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : getCookie('csrftoken');
}

function fetchJson(url, options = {}) {
    const csrfToken = getCsrfToken();
    options.headers = {
        ...(options.headers || {}),
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
    };
    return fetch(url, options);
}

function updateBalanceUI() {
    document.getElementById("balance").innerText =
        `Remaining Balance: P${Number(currentBalance).toFixed(2)}`;
}

function updateGoalUI() {
    document.getElementById("goal").innerText =
        `P${Number(currentGoal).toFixed(2)}`;

    const progressBar = document.getElementById("progress-goal");

    if (currentGoal <= 0) {
        progressBar.style.width = "0%";
        progressBar.innerText = "0%";
        return;
    }

    let progress = (currentBalance / currentGoal) * 100;

    progress = Math.max(0, Math.min(progress, 100));

    progressBar.style.width = `${Math.min(Math.abs(progress), 100).toFixed(2)}%`;
    progressBar.innerText = `${Number(progress).toFixed(2)}%`;
}

function refreshAnalytics() {
    const dailyBudget = currentBudget / 7;

    if (currentBudget === 0) {
        for (let i = 0; i < days.length; i++) {
            const progressBar = document.getElementById(`progress-${days[i]}`);
            progressBar.style.width = '0%';
            progressBar.style.backgroundColor = '#ffd063';
            progressBar.innerText = '+0.00';
        }
        return;
    }

    for (let i = 0; i < days.length; i++) {
        const progressBar = document.getElementById(`progress-${days[i]}`);
        const spent = dailySpent[i] || 0;
        const remaining = dailyBudget - spent;

        let remainingPercent;
        if (remaining >= 0) {
            remainingPercent = (remaining / dailyBudget) * 100;
        } else {
            remainingPercent = 100;
        }

        const sign = remaining >= 0 ? '+' : '';

        progressBar.style.backgroundColor = remaining >= 0 ? '#FFD063' : '#ff6363';
        // width as percentage (clamped) with 2 decimals
        const widthPct = Math.min(Math.abs(remainingPercent), 100);
        progressBar.style.width = `${widthPct.toFixed(2)}%`;
        // display remaining with 2 decimals
        progressBar.innerText = `${sign}${Number(remaining).toFixed(2)}`;
    }
}

function updateBudgetUI() {
    document.getElementById("budget").innerText =
        `Weekly Budget: P${Number(currentBudget).toFixed(2)}`;
}

function handleApiResponse(res) {
    if (!res.ok) {
        return res.json().then(err => {
            console.error('API error', res.status, err);
            throw err;
        });
    }
    return res.json();
}

window.addEventListener('DOMContentLoaded', function () {
    const btnUpdate = document.getElementById("btn-update");
    const btnGoal = document.getElementById("btn-goal");
    const btnBudget = document.getElementById("btn-budget");
    const btnLog = document.getElementById("btn-log");

    if (btnUpdate) {
        btnUpdate.onclick = function () {
            const amount = Number(document.getElementById("input-update").value);
            if (isNaN(amount) || amount < 0) return;

            fetch("/dashboard-data/", { credentials: "include" })
                .then(handleApiResponse)
                .then(data => {
                    const newBudget = amount + data.total_spent;
                    currentBalance = amount;
                    currentBudget = newBudget;
                    dailySpent = data.daily_spent || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

                    updateBudgetUI();
                    updateBalanceUI();
                    updateGoalUI();
                    refreshAnalytics();

                    return fetchJson("/update-budget/", {
                        method: "POST",
                        credentials: "include",
                        body: JSON.stringify({ budget: newBudget })
                    });
                })
                .catch(err => console.error('Budget update failed', err));
        };
    }

    if (btnGoal) {
        btnGoal.onclick = function () {
            const goal = Number(document.getElementById("input-goal").value);
            if (isNaN(goal) || goal < 0) return;

            currentGoal = goal;
            updateGoalUI();

            fetchJson("/update-goal/", {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({ goal: goal })
            })
                .then(handleApiResponse)
                .then(() => refreshAnalytics())
                .catch(err => console.error('Goal update failed', err));
        };
    }

    if (btnBudget) {
        btnBudget.onclick = function () {
            const budget = Number(document.getElementById("input-budget").value);
            if (isNaN(budget) || budget < 0) return;

            currentBudget = budget;
            currentBalance = budget;

            updateBudgetUI();
            updateBalanceUI();
            updateGoalUI();
            refreshAnalytics();

            fetchJson("/update-budget/", {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({ budget: budget })
            })
                .then(handleApiResponse)
                .then(() => fetch("/dashboard-data/", { credentials: "include" }))
                .then(handleApiResponse)
                .then(data => {
                    dailySpent = data.daily_spent || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
                    refreshAnalytics();
                })
                .catch(err => console.error('Budget save failed', err));
        };
    }

    const btnNote = document.getElementById("btn-note");
    const notesContainer = document.getElementById("notes");

    function renderWishlistItem(item) {
        if (notesContainer) {
            const emptyText = notesContainer.querySelector('.wishlist-empty');
            if (emptyText) {
                emptyText.remove();
            }
            const noteHtml = `
                                <div class="wishlist-row${item.is_bought ? ' bought' : ''}">
                                    <div class="form-check">
                                        <input class="form-check-input wishlist-checkbox" type="checkbox" value="${item.id}" id="wishlist-${item.id}" ${item.is_bought ? 'checked disabled' : ''} ${item.price != null ? `data-price="${item.price}"` : ''} />
                                        <label class="form-check-label" for="wishlist-${item.id}">
                                            ${item.title}${item.price != null ? ` — P${Number(item.price).toFixed(2)}` : ''}
                                        </label>
                                    </div>
                                </div>
                        `;
            notesContainer.insertAdjacentHTML('beforeend', noteHtml);
        }
    }

    function handleWishlistChange(event) {
        const checkbox = event.target;
        if (!checkbox.classList.contains('wishlist-checkbox')) return;
        if (!checkbox.checked || checkbox.disabled) return;

        const itemId = checkbox.value;
        if (!itemId) return;

        // optimistic UI update: subtract (price/7) from each day's remaining
        const priceAttr = checkbox.dataset.price;
        const priceVal = priceAttr !== undefined ? Number(priceAttr) : null;
        if (priceVal != null && !isNaN(priceVal)) {
            const perDay = priceVal / 7;
            for (let i = 0; i < days.length; i++) {
                dailySpent[i] = Number(dailySpent[i] || 0) + perDay;
            }
            currentBalance = Number(currentBalance) - priceVal;
            updateBalanceUI();
            refreshAnalytics();
        }

        fetchJson('/mark-wishlist-bought/', {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify({ id: itemId })
        })
            .then(handleApiResponse)
            .then(data => {
                // server returns updated dashboard-like payload; use it to refresh UI
                checkbox.disabled = true;
                checkbox.closest('.wishlist-row')?.classList.add('bought');

                // If server returned updated dashboard data, apply it
                if (data && (data.daily_spent || data.total_spent != null)) {
                    // `daily_spent` keys are strings '0'..'6'
                    const ds = data.daily_spent || {};
                    for (let i = 0; i < days.length; i++) {
                        dailySpent[i] = Number(ds[i] || ds[String(i)] || 0);
                    }
                    currentBudget = data.budget || currentBudget;
                    currentGoal = data.goal || currentGoal;
                    currentBalance = (data.balance != null) ? Number(data.balance) : currentBalance;

                    updateBudgetUI();
                    updateBalanceUI();
                    updateGoalUI();
                    refreshAnalytics();
                } else {
                    // fallback: refresh from server
                    fetch("/dashboard-data/", { credentials: "include" })
                        .then(handleApiResponse)
                        .then(d => {
                            currentBudget = d.budget;
                            currentGoal = d.goal;
                            currentBalance = d.balance;
                            dailySpent = d.daily_spent || dailySpent;
                            updateBudgetUI();
                            updateBalanceUI();
                            updateGoalUI();
                            refreshAnalytics();
                        })
                        .catch(err => console.error('Fetch dashboard after wishlist failed', err));
                }
            })
            .catch(err => console.error('Mark wishlist bought failed', err));
    }

    if (btnNote) {
        btnNote.onclick = function () {
            const title = document.getElementById("input-note").value.trim();
            const priceValue = document.getElementById("input-note-price").value;
            const price = priceValue === "" ? null : Number(priceValue);

            if (!title) {
                console.log('Wishlist title is required');
                return;
            }

            if (price === null || isNaN(price) || price < 0) {
                console.log('Wishlist price is required and must be a valid number');
                return;
            }

            fetchJson("/add-wishlist/", {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({
                    title: title,
                    price: price
                })
            })
                .then(handleApiResponse)
                .then(data => {
                    renderWishlistItem(data);
                    document.getElementById("input-note").value = "";
                    document.getElementById("input-note-price").value = "";
                })
                .catch(err => console.error('Add wishlist failed', err));
        };
    }

    if (notesContainer) {
        notesContainer.addEventListener('change', handleWishlistChange);
    }

    if (btnLog) {
        btnLog.onclick = function () {
            const expense = Number(document.getElementById("input-log-amount").value);
            const desc = document.getElementById("input-log-desc").value;
            const dateInput = document.getElementById("input-log-date").value;
            const isWishlist = false;

            console.log('Log expense click', { expense, desc, dateInput, isWishlist });

            if (isNaN(expense) || expense <= 0 || !desc || !dateInput) {
                console.log('Invalid expense input');
                return;
            }

            fetchJson("/add-expense/", {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({
                    description: desc,
                    amount: expense,
                    date: dateInput,
                    is_wishlist: isWishlist
                })
            })
                .then(handleApiResponse)
                .then(() => fetch("/dashboard-data/", { credentials: "include" }))
                .then(handleApiResponse)
                .then(data => {
                    currentBalance = data.budget - data.total_spent;
                    dailySpent = data.daily_spent || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
                    updateBalanceUI();
                    updateGoalUI();
                    refreshAnalytics();
                })
                .catch(err => console.error('Expense log failed', err));
        };
    }

    fetch("/dashboard-data/", { credentials: "include" })
        .then(handleApiResponse)
        .then(data => {
            currentBudget = data.budget;
            currentGoal = data.goal;
            currentBalance = data.budget - data.total_spent;
            dailySpent = data.daily_spent || { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
            updateBudgetUI();
            updateBalanceUI();
            updateGoalUI();
            refreshAnalytics();
        })
        .catch(err => console.error('Dashboard load failed', err));
});