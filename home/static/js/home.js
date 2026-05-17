console.info('home.js loaded');
let currentBalance = 0;
let currentGoal = 0;
let currentBudget = 0;
let dailySpent = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};

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
        `Remaining Balance: P${currentBalance}`;
}

function updateGoalUI() {
    document.getElementById("goal").innerText =
        `P${currentGoal}`;

    const progressBar = document.getElementById("progress-goal");

    if (currentGoal <= 0) {
        progressBar.style.width = "0%";
        progressBar.innerText = "0%";
        return;
    }

    let progress = (currentBalance / currentGoal) * 100;

    progress = Math.max(0, Math.min(progress, 100));

    progressBar.style.width = `${progress}%`;
    progressBar.innerText = `${Math.floor(progress)}%`;
}

function refreshAnalytics() {
    const dailyBudget = currentBudget / 7;

    if (currentBudget === 0) {
        for (let i = 0; i < days.length; i++) {
            const progressBar = document.getElementById(`progress-${days[i]}`);
            progressBar.style.width = '0%';
            progressBar.style.backgroundColor = '#ffd063';
            progressBar.innerText = '+0';
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
        progressBar.style.width = `${remainingPercent}%`;
        progressBar.innerText = `${sign}${Math.floor(remaining)}`;
    }
}

function updateBudgetUI() {
    document.getElementById("budget").innerText =
        `Weekly Budget: P${currentBudget}`;
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
                    dailySpent = data.daily_spent || {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};

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
                dailySpent = data.daily_spent || {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
                refreshAnalytics();
            })
            .catch(err => console.error('Budget save failed', err));
        };
    }

    if (btnLog) {
        btnLog.onclick = function () {
            const expense = Number(document.getElementById("input-log-amount").value);
            const desc = document.getElementById("input-log-desc").value;
            const dateInput = document.getElementById("input-log-date").value;

            console.log('Log expense click', { expense, desc, dateInput });

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
                    date: dateInput
                })
            })
            .then(handleApiResponse)
            .then(() => fetch("/dashboard-data/", { credentials: "include" }))
            .then(handleApiResponse)
            .then(data => {
                currentBalance = data.budget - data.total_spent;
                dailySpent = data.daily_spent || {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
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
            dailySpent = data.daily_spent || {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
            updateBudgetUI();
            updateBalanceUI();
            updateGoalUI();
            refreshAnalytics();
        })
        .catch(err => console.error('Dashboard load failed', err));
});