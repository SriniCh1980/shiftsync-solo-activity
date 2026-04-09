---
name: ea-employee-playwright
description: >
  Comprehensive Playwright E2E testing skill for the EA Employee Manager application
  (React + Material UI frontend, Node.js/Express/SQLite backend). ALWAYS use this skill
  when writing, running, debugging, or reviewing Playwright tests for this app. Covers
  login flows, employee CRUD (add/edit/delete/view), real-time search and filtering,
  modal dialog behaviour, API mocking, error handling, dark mode, responsive layout,
  auth guards, and CI/CD integration. Also trigger when the user asks to generate test
  cases, set up Playwright config, write Page Object Models, fix flaky tests, or add
  API-level request interception for the /api/* endpoints of this application.
---

# EA Employee Manager — Playwright Testing Skill

> Senior-grade E2E automation skill for the **EA Employee Manager** full-stack app.  
> Built with: **React + Material UI** · **Node.js / Express** · **SQLite**

---

## 1. Application Overview

| Layer | Tech | Key Detail |
|-------|------|-----------|
| Frontend | React + MUI + Vite | Runs on `http://localhost:5173` |
| Backend | Node.js + Express | Runs on `http://localhost:4000` |
| Database | SQLite (file-based) | `backend/db.sqlite` |
| Auth | Dummy login | Any credentials succeed |
| Proxy | Vite `/api/*` → backend | All API calls go through `/api/` |

---

## 2. Route & Feature Map

| Route | Component | Behaviour |
|-------|-----------|-----------|
| `/` | `Login` | Fills username + password → POST `/api/login` → stores `loggedIn` + `username` in localStorage → redirects to `/list` |
| `/list` | `EmployeeList` | Loads all employees; real-time search by name/email/position; View / Edit / Delete actions |
| `/list` + Add modal | `EmployeeForm` | POST `/api/employees` → success alert → auto-closes after **1.5 s** → refreshes list |
| `/list` + Edit modal | `EmployeeForm` | Pre-fills form → PUT `/api/employees/:id` → same 1.5 s flow |
| `/list` + Delete dialog | inline | Confirmation dialog → DELETE `/api/employees/:id` → Snackbar success |
| `/list` + View dialog | inline | Read-only details: ID, Name, Email, Position |

---

## 3. Playwright Configuration

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,        // SQLite is file-based — serialise to prevent race conditions
  retries: 1,                  // 1 retry for flaky network ops
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile',   use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      command: 'node backend/server.js',
      url: 'http://localhost:4000',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --prefix frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

---

## 4. Shared Fixture — `loggedInPage`

Use this fixture to skip the login UI in every test that needs an authenticated session:

```ts
// tests/fixtures/auth.fixture.ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('username', 'testuser');
    });
    await page.goto('/list');
    await expect(page.getByRole('heading', { name: /employee list/i })).toBeVisible();
    await use(page);
  },
});

export { expect };
```

---

## 5. Page Object Models

### `LoginPage`
```ts
// tests/pages/LoginPage.ts
import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/'); }

  async login(username: string, password: string) {
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async expectRedirectedToList() {
    await expect(this.page).toHaveURL('/list');
  }

  async expectError(text: RegExp) {
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
```

### `EmployeeListPage`
```ts
// tests/pages/EmployeeListPage.ts
import { Page, expect } from '@playwright/test';

export class EmployeeListPage {
  constructor(private page: Page) {}

  async goto() { await this.page.goto('/list'); }

  async search(query: string) {
    await this.page.getByLabel('Search employees').fill(query);
  }

  async clearSearch() {
    await this.page.getByLabel('Search employees').clear();
  }

  async clickAddEmployee() {
    await this.page.getByRole('button', { name: /add employee/i }).click();
  }

  row(name: string) {
    return this.page.getByRole('row', { name: new RegExp(name, 'i') });
  }

  async clickAction(employeeName: string, action: 'View' | 'Edit' | 'Delete') {
    await this.row(employeeName).getByRole('button', { name: action }).click();
  }

  async expectEmployeeVisible(name: string) {
    await expect(this.page.getByRole('cell', { name })).toBeVisible();
  }

  async expectEmployeeNotVisible(name: string) {
    await expect(this.page.getByRole('cell', { name })).not.toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.page.getByText('No employees found.')).toBeVisible();
  }

  async expectErrorAlert() {
    await expect(this.page.getByRole('alert').filter({ hasText: /failed/i })).toBeVisible();
  }

  async expectSuccessSnackbar() {
    await expect(this.page.getByRole('alert').filter({ hasText: /success/i })).toBeVisible();
  }
}
```

### `EmployeeFormModal`
```ts
// tests/pages/EmployeeFormModal.ts
import { Page, expect } from '@playwright/test';

export class EmployeeFormModal {
  private dialog = this.page.getByRole('dialog');

  constructor(private page: Page) {}

  async fill(name: string, email: string, position: string) {
    await this.dialog.getByLabel('Name').fill(name);
    await this.dialog.getByLabel('Email').fill(email);
    await this.dialog.getByLabel('Position').fill(position);
  }

  async submit(mode: 'Add Employee' | 'Update Employee') {
    await this.dialog.getByRole('button', { name: mode }).click();
  }

  async expectSuccess() {
    await expect(this.dialog.getByRole('alert').filter({ hasText: /successfully/i })).toBeVisible();
  }

  async expectError() {
    await expect(this.dialog.getByRole('alert').filter({ hasText: /failed|error/i })).toBeVisible();
  }

  async expectAutoClose() {
    await expect(this.dialog).not.toBeVisible({ timeout: 4000 });
  }

  async expectOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async getFieldValue(label: string) {
    return this.dialog.getByLabel(label).inputValue();
  }
}
```

---

## 6. API Helper Utilities

```ts
// tests/helpers/api.ts
import { APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:4000';

export async function createEmployee(
  request: APIRequestContext,
  data: { name: string; email: string; position: string }
) {
  const res = await request.post(`${BASE}/employees`, { data });
  return res.json() as Promise<{ id: number; name: string; email: string; position: string }>;
}

export async function deleteEmployee(request: APIRequestContext, id: number) {
  await request.delete(`${BASE}/employees/${id}`);
}

export async function getAllEmployees(request: APIRequestContext) {
  const res = await request.get(`${BASE}/employees`);
  return res.json() as Promise<{ id: number; name: string; email: string; position: string }[]>;
}
```

---

## 7. Test Coverage Matrix

| # | Area | Scenario | Priority |
|---|------|----------|----------|
| TC-01 | Login | Happy path — any credentials succeed | 🔴 High |
| TC-02 | Login | Username stored in localStorage | 🔴 High |
| TC-03 | Login | Network error shows error message | 🔴 High |
| TC-04 | Login | 500 error shows error message | 🟡 Medium |
| TC-05 | Login | Empty fields — native validation | 🟡 Medium |
| TC-06 | Employee List | Table headers visible | 🔴 High |
| TC-07 | Employee List | Empty state message | 🟡 Medium |
| TC-08 | Employee List | Search by name | 🔴 High |
| TC-09 | Employee List | Search by email | 🔴 High |
| TC-10 | Employee List | Search by position | 🔴 High |
| TC-11 | Employee List | Clear search shows all employees | 🟡 Medium |
| TC-12 | Employee List | API error on load | 🟡 Medium |
| TC-13 | Add Employee | Modal opens | 🔴 High |
| TC-14 | Add Employee | Successful add → success alert → auto-close | 🔴 High |
| TC-15 | Add Employee | Employee appears in table after add | 🔴 High |
| TC-16 | Add Employee | Required field validation | 🟡 Medium |
| TC-17 | Add Employee | API error shown inside modal | 🟡 Medium |
| TC-18 | View Employee | Dialog shows all 4 fields | 🔴 High |
| TC-19 | View Employee | Close button dismisses dialog | 🟡 Medium |
| TC-20 | Edit Employee | Form pre-filled with existing data | 🔴 High |
| TC-21 | Edit Employee | Successful update → table reflects changes | 🔴 High |
| TC-22 | Edit Employee | Cancel closes without saving | 🔴 High |
| TC-23 | Delete Employee | Confirmation dialog shows name | 🔴 High |
| TC-24 | Delete Employee | Confirm delete removes from table | 🔴 High |
| TC-25 | Delete Employee | Cancel preserves employee | 🔴 High |
| TC-26 | Navigation | Unauthenticated redirect to `/` | 🔴 High |
| TC-27 | Navigation | Menu bar visible after login | 🟡 Medium |
| TC-28 | Dark Mode | Theme toggle changes appearance | 🟢 Low |
| TC-29 | Responsive | Mobile layout renders correctly | 🟢 Low |

---

## 8. Key Patterns & Best Practices

### Wait for modal auto-close (1.5 s delay in app)
```ts
await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 4000 });
```

### Prefer role-based selectors (MUI-stable)
```ts
// ✅ Good — survives MUI class name changes
page.getByRole('button', { name: 'Login' })
page.getByLabel('Username')
page.getByRole('cell', { name: 'John Doe' })

// ❌ Avoid — brittle
page.locator('.MuiButton-root')
page.locator('#username')
```

### Mock API errors
```ts
await page.route('**/api/employees', route => {
  if (route.request().method() === 'POST') {
    return route.fulfill({ status: 500, json: { error: 'DB write failed' } });
  }
  return route.continue();
});
```

### Always clean up test data
```ts
test.afterEach(async ({ request }) => {
  const employees = await getAllEmployees(request);
  const testEmps = employees.filter(e => e.email.includes('@test-'));
  for (const emp of testEmps) await deleteEmployee(request, emp.id);
});
```
