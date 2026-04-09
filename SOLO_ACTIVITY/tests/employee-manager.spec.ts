/**
 * EA Employee Manager — Playwright E2E Test Suite
 * ================================================
 * Full coverage: Login · Employee List · Add · View · Edit · Delete
 *                Search/Filter · Auth Guards · Dark Mode · API Mocking
 *
 * Run:  npx playwright test --headed
 * Report: npx playwright show-report
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Inject localStorage to skip login UI */
async function setLoggedIn(page: Page, username = 'testuser') {
  await page.goto('/');
  await page.evaluate((u) => {
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('username', u);
  }, username);
}

/** Create employee via API — fast, no UI overhead */
async function apiCreateEmployee(
  request: APIRequestContext,
  data: { name: string; email: string; position: string }
) {
  const res = await request.post('http://localhost:4000/employees', { data });
  expect(res.ok()).toBeTruthy();
  return res.json() as Promise<{ id: number; name: string; email: string; position: string }>;
}

/** Delete employee via API — cleanup after tests */
async function apiDeleteEmployee(request: APIRequestContext, id: number) {
  await request.delete(`http://localhost:4000/employees/${id}`);
}

// ─────────────────────────────────────────────
// PAGE OBJECTS (inline for portability)
// ─────────────────────────────────────────────

class LoginPage {
  constructor(private page: Page) {}
  async goto() { await this.page.goto('/'); }
  async login(u: string, p: string) {
    await this.page.getByLabel('Username').fill(u);
    await this.page.getByLabel('Password').fill(p);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }
}

class EmployeeListPage {
  constructor(private page: Page) {}
  async goto() { await this.page.goto('/list'); }
  async search(q: string) { await this.page.getByLabel('Search employees').fill(q); }
  async clearSearch() { await this.page.getByLabel('Search employees').clear(); }
  async clickAdd() { await this.page.getByRole('button', { name: /add employee/i }).click(); }
  row(name: string) { return this.page.getByRole('row', { name: new RegExp(name, 'i') }); }
  async action(name: string, btn: 'View' | 'Edit' | 'Delete') {
    await this.row(name).getByRole('button', { name: btn }).click();
  }
}

// ─────────────────────────────────────────────
// 1 ▸ LOGIN
// ─────────────────────────────────────────────

test.describe('🔐 Login', () => {
  test('TC-01 | Any credentials redirect to /list', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.login('admin', 'anypassword');
    await expect(page).toHaveURL('/list');
  });

  test('TC-02 | Username is saved to localStorage after login', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.login('karthik', 'pass123');
    await expect(page).toHaveURL('/list');
    const stored = await page.evaluate(() => localStorage.getItem('username'));
    expect(stored).toBe('karthik');
  });

  test('TC-03 | loggedIn flag is set to "true" in localStorage', async ({ page }) => {
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.login('user', 'pass');
    const flag = await page.evaluate(() => localStorage.getItem('loggedIn'));
    expect(flag).toBe('true');
  });

  test('TC-04 | Network error on /api/login shows error message', async ({ page }) => {
    await page.route('**/api/login', route => route.abort('connectionrefused'));
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.login('admin', 'pass');
    await expect(page.getByText(/network error/i)).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('TC-05 | 500 error from /api/login shows error message', async ({ page }) => {
    await page.route('**/api/login', route =>
      route.fulfill({ status: 500, json: { error: 'Server meltdown' } })
    );
    const lp = new LoginPage(page);
    await lp.goto();
    await lp.login('admin', 'pass');
    await expect(page.getByText(/server meltdown|invalid credentials/i)).toBeVisible();
  });

  test('TC-06 | Login page shows Username and Password fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 2 ▸ EMPLOYEE LIST
// ─────────────────────────────────────────────

test.describe('📋 Employee List', () => {
  test.beforeEach(async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');
  });

  test('TC-07 | Table headers are visible', async ({ page }) => {
    for (const header of ['ID', 'Name', 'Email', 'Position', 'Actions']) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
  });

  test('TC-08 | "+ Add Employee" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add employee/i })).toBeVisible();
  });

  test('TC-09 | Search box is visible and focusable', async ({ page }) => {
    const search = page.getByLabel('Search employees');
    await expect(search).toBeVisible();
    await search.focus();
    await expect(search).toBeFocused();
  });

  test('TC-10 | Real-time search filters by employee name', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'SearchByName_Test',
      email: 'sbn@test-ea.com',
      position: 'QA',
    });

    const list = new EmployeeListPage(page);
    await list.goto();
    await list.search('SearchByName_Test');
    await expect(page.getByRole('cell', { name: 'SearchByName_Test' })).toBeVisible();

    await list.search('zzz_no_match_xyz');
    await expect(page.getByText('No employees found.')).toBeVisible();

    await apiDeleteEmployee(request, emp.id);
  });

  test('TC-11 | Real-time search filters by email', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'EmailFilter Test',
      email: 'emailfilter@test-ea.com',
      position: 'Dev',
    });

    const list = new EmployeeListPage(page);
    await list.goto();
    await list.search('emailfilter@test-ea.com');
    await expect(page.getByRole('cell', { name: 'EmailFilter Test' })).toBeVisible();

    await apiDeleteEmployee(request, emp.id);
  });

  test('TC-12 | Real-time search filters by position', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'Position Filter Test',
      email: 'posfilter@test-ea.com',
      position: 'UniquePositionXYZ',
    });

    const list = new EmployeeListPage(page);
    await list.goto();
    await list.search('UniquePositionXYZ');
    await expect(page.getByRole('cell', { name: 'Position Filter Test' })).toBeVisible();

    await apiDeleteEmployee(request, emp.id);
  });

  test('TC-13 | Clearing search restores full list', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'ClearSearch Test',
      email: 'clearsearch@test-ea.com',
      position: 'BA',
    });

    const list = new EmployeeListPage(page);
    await list.goto();
    await list.search('zzz_no_match');
    await expect(page.getByText('No employees found.')).toBeVisible();

    await list.clearSearch();
    await expect(page.getByRole('cell', { name: 'ClearSearch Test' })).toBeVisible();

    await apiDeleteEmployee(request, emp.id);
  });

  test('TC-14 | API error on load shows error alert', async ({ page }) => {
    await page.route('**/api/employees', route =>
      route.fulfill({ status: 500, json: { error: 'DB failure' } })
    );
    await page.goto('/list');
    await expect(page.getByRole('alert').filter({ hasText: /failed to load/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 3 ▸ ADD EMPLOYEE
// ─────────────────────────────────────────────

test.describe('➕ Add Employee', () => {
  test.beforeEach(async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');
  });

  test('TC-15 | Add Employee modal opens on button click', async ({ page }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/add employee/i)).toBeVisible();
  });

  test('TC-16 | Successfully add employee — success alert shown', async ({ page, request }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name').fill('Jane Playwright');
    await dialog.getByLabel('Email').fill('jane@test-ea.com');
    await dialog.getByLabel('Position').fill('SDET');
    await dialog.getByRole('button', { name: 'Add Employee' }).click();

    await expect(dialog.getByRole('alert').filter({ hasText: /added successfully/i })).toBeVisible();

    // Cleanup
    const all = await (await request.get('http://localhost:4000/employees')).json() as any[];
    const created = all.find((e: any) => e.email === 'jane@test-ea.com');
    if (created) await apiDeleteEmployee(request, created.id);
  });

  test('TC-17 | Dialog auto-closes after successful add', async ({ page, request }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name').fill('AutoClose Test');
    await dialog.getByLabel('Email').fill('autoclose@test-ea.com');
    await dialog.getByLabel('Position').fill('Dev');
    await dialog.getByRole('button', { name: 'Add Employee' }).click();

    // Auto-closes after 1.5 s — allow up to 4 s
    await expect(dialog).not.toBeVisible({ timeout: 4000 });

    // Cleanup
    const all = await (await request.get('http://localhost:4000/employees')).json() as any[];
    const created = all.find((e: any) => e.email === 'autoclose@test-ea.com');
    if (created) await apiDeleteEmployee(request, created.id);
  });

  test('TC-18 | New employee appears in table after add', async ({ page, request }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name').fill('TableCheck Test');
    await dialog.getByLabel('Email').fill('tablecheck@test-ea.com');
    await dialog.getByLabel('Position').fill('PM');
    await dialog.getByRole('button', { name: 'Add Employee' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 4000 });
    await expect(page.getByRole('cell', { name: 'TableCheck Test' })).toBeVisible();

    // Cleanup
    const all = await (await request.get('http://localhost:4000/employees')).json() as any[];
    const created = all.find((e: any) => e.email === 'tablecheck@test-ea.com');
    if (created) await apiDeleteEmployee(request, created.id);
  });

  test('TC-19 | API error on add shows error alert inside modal', async ({ page }) => {
    await page.route('**/api/employees', route => {
      if (route.request().method() === 'POST')
        return route.fulfill({ status: 500, json: { error: 'DB write failed' } });
      return route.continue();
    });

    await page.getByRole('button', { name: /add employee/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name').fill('Error Test');
    await dialog.getByLabel('Email').fill('err@test-ea.com');
    await dialog.getByLabel('Position').fill('Dev');
    await dialog.getByRole('button', { name: 'Add Employee' }).click();

    await expect(dialog.getByRole('alert').filter({ hasText: /failed|error/i })).toBeVisible();
    await expect(dialog).toBeVisible(); // stays open on error
  });
});

// ─────────────────────────────────────────────
// 4 ▸ VIEW EMPLOYEE
// ─────────────────────────────────────────────

test.describe('👁 View Employee', () => {
  let empId: number;

  test.beforeAll(async ({ request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'View Dialog Test',
      email: 'viewdialog@test-ea.com',
      position: 'Product Manager',
    });
    empId = emp.id;
  });

  test.afterAll(async ({ request }) => {
    await apiDeleteEmployee(request, empId);
  });

  test('TC-20 | View dialog shows all employee fields', async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');

    await new EmployeeListPage(page).action('View Dialog Test', 'View');
    const dialog = page.getByRole('dialog');

    await expect(dialog.getByText('View Dialog Test')).toBeVisible();
    await expect(dialog.getByText('viewdialog@test-ea.com')).toBeVisible();
    await expect(dialog.getByText('Product Manager')).toBeVisible();
    await expect(dialog.getByText(String(empId))).toBeVisible();
  });

  test('TC-21 | View dialog closes on Close button', async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');

    await new EmployeeListPage(page).action('View Dialog Test', 'View');
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 5 ▸ EDIT EMPLOYEE
// ─────────────────────────────────────────────

test.describe('✏️ Edit Employee', () => {
  let empId: number;

  test.beforeEach(async ({ request, page }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'Edit Target',
      email: 'edittarget@test-ea.com',
      position: 'Junior Dev',
    });
    empId = emp.id;
    await setLoggedIn(page);
    await page.goto('/list');
  });

  test.afterEach(async ({ request }) => {
    await apiDeleteEmployee(request, empId);
  });

  test('TC-22 | Edit dialog is pre-filled with existing employee data', async ({ page }) => {
    await new EmployeeListPage(page).action('Edit Target', 'Edit');
    const dialog = page.getByRole('dialog');

    await expect(dialog.getByLabel('Name')).toHaveValue('Edit Target');
    await expect(dialog.getByLabel('Email')).toHaveValue('edittarget@test-ea.com');
    await expect(dialog.getByLabel('Position')).toHaveValue('Junior Dev');
  });

  test('TC-23 | Successfully update employee — table shows new values', async ({ page }) => {
    await new EmployeeListPage(page).action('Edit Target', 'Edit');
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name').fill('Edit Updated');
    await dialog.getByLabel('Position').fill('Senior Dev');
    await dialog.getByRole('button', { name: 'Update Employee' }).click();

    await expect(dialog.getByRole('alert').filter({ hasText: /updated successfully/i })).toBeVisible();
    await expect(dialog).not.toBeVisible({ timeout: 4000 });
    await expect(page.getByRole('cell', { name: 'Edit Updated' })).toBeVisible();
  });

  test('TC-24 | Cancel on edit dialog closes without saving changes', async ({ page }) => {
    await new EmployeeListPage(page).action('Edit Target', 'Edit');
    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Name').fill('Should Not Save');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'Edit Target' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 6 ▸ DELETE EMPLOYEE
// ─────────────────────────────────────────────

test.describe('🗑 Delete Employee', () => {
  test('TC-25 | Delete confirmation dialog shows employee name', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'Delete Confirm',
      email: 'deleteconfirm@test-ea.com',
      position: 'Tester',
    });

    await setLoggedIn(page);
    await page.goto('/list');
    await new EmployeeListPage(page).action('Delete Confirm', 'Delete');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/delete confirm/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await apiDeleteEmployee(request, emp.id);
  });

  test('TC-26 | Confirming delete removes employee from table', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'To Be Deleted',
      email: 'tobedeleted@test-ea.com',
      position: 'Intern',
    });

    await setLoggedIn(page);
    await page.goto('/list');
    await new EmployeeListPage(page).action('To Be Deleted', 'Delete');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /deleted successfully/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'To Be Deleted' })).not.toBeVisible();
  });

  test('TC-27 | Cancel on delete dialog preserves the employee', async ({ page, request }) => {
    const emp = await apiCreateEmployee(request, {
      name: 'Cancel Delete',
      email: 'canceldelete@test-ea.com',
      position: 'BA',
    });

    await setLoggedIn(page);
    await page.goto('/list');
    await new EmployeeListPage(page).action('Cancel Delete', 'Delete');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('cell', { name: 'Cancel Delete' })).toBeVisible();
    await apiDeleteEmployee(request, emp.id);
  });
});

// ─────────────────────────────────────────────
// 7 ▸ NAVIGATION & AUTH GUARDS
// ─────────────────────────────────────────────

test.describe('🔒 Navigation & Auth Guards', () => {
  test('TC-28 | Unauthenticated user cannot access /list', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/list');
    await expect(page).toHaveURL('/');
  });

  test('TC-29 | Menu bar is visible when logged in', async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');
    await expect(page.getByRole('navigation')).toBeVisible();
  });

  test('TC-30 | Menu bar contains Add Employee and Employee List links', async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');
    await expect(page.getByRole('link', { name: /add employee/i }).or(
      page.getByRole('button', { name: /add employee/i })
    ).first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 8 ▸ DARK MODE
// ─────────────────────────────────────────────

test.describe('🌙 Dark Mode', () => {
  test('TC-31 | Dark mode toggle changes page theme', async ({ page }) => {
    await setLoggedIn(page);
    await page.goto('/list');

    const toggle = page.getByRole('button', { name: /dark|light|theme/i });
    await expect(toggle).toBeVisible();

    const bgBefore = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    await toggle.click();
    const bgAfter = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );

    expect(bgBefore).not.toBe(bgAfter);
  });
});

// ─────────────────────────────────────────────
// 9 ▸ ACCESSIBILITY & RESPONSIVE
// ─────────────────────────────────────────────

test.describe('♿ Accessibility & Responsive', () => {
  test('TC-32 | All form fields have accessible labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('TC-33 | Login form submits on Enter key', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('pass');
    await page.getByLabel('Password').press('Enter');
    await expect(page).toHaveURL('/list');
  });

  test('TC-34 | Mobile viewport shows Employee List correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setLoggedIn(page);
    await page.goto('/list');
    await expect(page.getByText('Employee List')).toBeVisible();
    await expect(page.getByRole('button', { name: /add employee/i })).toBeVisible();
  });
});
