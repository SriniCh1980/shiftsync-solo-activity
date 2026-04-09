# 🏆 ShiftSync Solo Activity — EA Employee Manager Testing

> Playwright E2E test suite + SKILL definition for the EA Employee Manager application.

## 📁 Structure

```
SOLO_ACTIVITY/
├── agents/
│   └── playwright-tester.agent.md     # Provided by the activity
├── skills/
│   └── ea-employee-playwright/
│       └── SKILL.md                   # ✅ Custom SKILL definition
└── tests/
    └── employee-manager.spec.ts       # ✅ 34 Playwright E2E test cases
```

---

## 🧠 SKILL Definition

The `SKILL.md` defines a reusable Claude skill for testing this application. It includes:

- Full application map (routes, components, API endpoints)
- Playwright config with multi-browser + mobile support
- Page Object Models (LoginPage, EmployeeListPage, EmployeeFormModal)
- API helper utilities for fast test data setup/cleanup
- Test coverage matrix (34 scenarios with priority levels)
- Best practices & anti-patterns

---

## 🧪 Test Cases (34 total)

| Group | Count | Coverage |
|-------|-------|----------|
| 🔐 Login | 6 | Happy path, localStorage, network error, 500 error, field visibility |
| 📋 Employee List | 8 | Table headers, search by name/email/position, clear search, API error |
| ➕ Add Employee | 5 | Modal open, success, auto-close, table update, API error mock |
| 👁 View Employee | 2 | All fields displayed, Close button |
| ✏️ Edit Employee | 3 | Pre-fill, successful update, cancel |
| 🗑 Delete Employee | 3 | Confirmation dialog, confirm delete, cancel preserves |
| 🔒 Navigation & Auth | 3 | Unauthenticated redirect, menu bar, nav links |
| 🌙 Dark Mode | 1 | Theme toggle changes appearance |
| ♿ Accessibility | 3 | Form labels, Enter key submit, mobile viewport |

---

## 🚀 How to Run

```bash
# Install dependencies
npm install -D @playwright/test
npx playwright install

# Make sure both servers are running first:
# Terminal 1: cd backend && node server.js
# Terminal 2: cd frontend && npm run dev

# Run all tests
npx playwright test SOLO_ACTIVITY/tests/employee-manager.spec.ts

# Run with browser visible
npx playwright test --headed

# View HTML report
npx playwright show-report
```

---

## 🛠 Tech Stack

- **Testing:** Playwright + TypeScript
- **Frontend:** React + Material UI + Vite
- **Backend:** Node.js + Express + SQLite
- **Pattern:** Page Object Model + API helpers for setup/teardown
