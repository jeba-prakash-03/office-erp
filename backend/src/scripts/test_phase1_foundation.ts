process.env.TEST_MODE = '1';
import http from 'http';
import app from '../index';
import { query } from '../config/db';
import { buildDataScopeClause } from '../utils/dataScope';
import { AuthenticatedUser } from '../middleware/auth';

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function makeRequest(
  path: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<{ status: number; body: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const payload = body ? JSON.stringify(body) : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runPhase1Tests() {
  console.log('===============================================================');
  console.log('PHASE 1: FOUNDATION & AUTHENTICATION TEST SUITE');
  console.log('===============================================================');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      testsFailed++;
    }
  }

  try {
    // 1. Health check
    console.log('\n--- 1. Health Check ---');
    const healthRes = await makeRequest('/health');
    assert(healthRes.status === 200 && healthRes.body.status === 'ok', 'GET /api/health returns 200 OK');

    // 2. Register First Admin (Guarded: Should fail because Super Admin already seeded)
    console.log('\n--- 2. Register First Admin Guard ---');
    const firstAdminRes = await makeRequest('/auth/register-first-admin', 'POST', {
      email: 'newadmin@erp.local',
      password: 'Admin@Password123',
      firstName: 'New',
      lastName: 'Admin',
    });
    assert(
      firstAdminRes.status === 403,
      'POST /api/auth/register-first-admin rejects when users exist (Status 403)'
    );

    // 3. Login with Invalid Credentials
    console.log('\n--- 3. Login Bad Credentials ---');
    const badLoginRes = await makeRequest('/auth/login', 'POST', {
      email: 'admin@erp.local',
      password: 'WrongPassword!',
    });
    assert(
      badLoginRes.status === 401 && badLoginRes.body.error?.code === 'INVALID_CREDENTIALS',
      'POST /api/auth/login with wrong password returns 401 and INVALID_CREDENTIALS'
    );

    // 4. Login with Valid Credentials
    console.log('\n--- 4. Login Success ---');
    const loginRes = await makeRequest('/auth/login', 'POST', {
      email: 'admin@erp.local',
      password: 'Admin@123456',
    });
    assert(loginRes.status === 200, 'POST /api/auth/login returns 200 OK');
    assert(Boolean(loginRes.body.data?.accessToken), 'Response contains accessToken');
    assert(Boolean(loginRes.body.data?.refreshToken), 'Response contains refreshToken');
    assert(loginRes.body.data?.user?.roleName === 'super_admin', 'User has super_admin role');

    const accessToken = loginRes.body.data?.accessToken;
    let refreshToken = loginRes.body.data?.refreshToken;

    // 5. Get Current User (/api/auth/me)
    console.log('\n--- 5. Current User Identity (/api/auth/me) ---');
    const meRes = await makeRequest('/auth/me', 'GET', null, accessToken);
    assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK');
    assert(meRes.body.data?.email === 'admin@erp.local', 'Returned email matches token identity');
    assert(Array.isArray(meRes.body.data?.permissions), 'Permissions array returned');
    assert(meRes.body.data?.permissions.length > 20, 'Super admin has all permissions assigned');

    // 6. Refresh Token Rotation
    console.log('\n--- 6. Refresh Token Rotation ---');
    const refreshRes = await makeRequest('/auth/refresh', 'POST', { refreshToken });
    assert(refreshRes.status === 200, 'POST /api/auth/refresh returns 200 OK');
    assert(Boolean(refreshRes.body.data?.accessToken), 'New accessToken generated');
    assert(Boolean(refreshRes.body.data?.refreshToken), 'New refreshToken rotated');

    const rotatedAccessToken = refreshRes.body.data?.accessToken;
    refreshToken = refreshRes.body.data?.refreshToken;

    // 7. Active Sessions Tracking
    console.log('\n--- 7. User Sessions Management ---');
    const sessionsRes = await makeRequest('/auth/sessions', 'GET', null, rotatedAccessToken);
    assert(sessionsRes.status === 200, 'GET /api/auth/sessions returns 200 OK');
    assert(Array.isArray(sessionsRes.body.data), 'Sessions array returned');
    assert(sessionsRes.body.data.length > 0, 'Current active session is present in list');

    const sessionId = sessionsRes.body.data[0]?.id;
    if (sessionId) {
      const revokeRes = await makeRequest(`/auth/sessions/${sessionId}`, 'DELETE', null, rotatedAccessToken);
      assert(revokeRes.status === 200, 'DELETE /api/auth/sessions/:id revokes session');
    }

    // 8. Login History
    console.log('\n--- 8. Login History Audit ---');
    const historyRes = await makeRequest('/auth/login-history', 'GET', null, rotatedAccessToken);
    assert(historyRes.status === 200, 'GET /api/auth/login-history returns 200 OK');
    assert(Array.isArray(historyRes.body.data), 'History list returned');
    assert(Boolean(historyRes.body.meta?.total), 'Metadata pagination returned');

    // 9. Company Settings (GET & PUT)
    console.log('\n--- 9. Company Settings ---');
    const settingsGetRes = await makeRequest('/settings/company', 'GET', null, rotatedAccessToken);
    assert(settingsGetRes.status === 200, 'GET /api/settings/company returns 200 OK');
    assert(settingsGetRes.body.data?.timezone === 'Asia/Kolkata', 'Company timezone is Asia/Kolkata');

    const settingsPutRes = await makeRequest('/settings/company', 'PUT', {
      companyName: 'TechNova Solutions India Pvt Ltd',
      currency: 'INR',
      currencySymbol: '₹',
      timezone: 'Asia/Kolkata',
    }, rotatedAccessToken);
    assert(settingsPutRes.status === 200, 'PUT /api/settings/company updates company settings');

    // 10. Audit Logs
    console.log('\n--- 10. Audit Logs ---');
    const auditRes = await makeRequest('/audit-logs?limit=10', 'GET', null, rotatedAccessToken);
    assert(auditRes.status === 200, 'GET /api/audit-logs returns 200 OK');
    assert(Array.isArray(auditRes.body.data), 'Audit records array returned');
    assert(Boolean(auditRes.body.meta?.total), 'Audit logs meta pagination returned');

    // 11. Notifications
    console.log('\n--- 11. Notifications & Unread Count ---');
    const notifRes = await makeRequest('/notifications', 'GET', null, rotatedAccessToken);
    assert(notifRes.status === 200, 'GET /api/notifications returns 200 OK');

    const unreadRes = await makeRequest('/notifications/unread-count', 'GET', null, rotatedAccessToken);
    assert(unreadRes.status === 200, 'GET /api/notifications/unread-count returns 200 OK');

    const readAllRes = await makeRequest('/notifications/read-all', 'PUT', {}, rotatedAccessToken);
    assert(readAllRes.status === 200, 'PUT /api/notifications/read-all returns 200 OK');

    // 12. Change Password Flow
    console.log('\n--- 12. Change Password Flow ---');
    const changePassRes = await makeRequest('/auth/change-password', 'POST', {
      currentPassword: 'Admin@123456',
      newPassword: 'Admin@NewPassword99!',
    }, rotatedAccessToken);
    assert(changePassRes.status === 200, 'POST /api/auth/change-password returns 200 OK');

    // Verify login with new password
    const newLoginRes = await makeRequest('/auth/login', 'POST', {
      email: 'admin@erp.local',
      password: 'Admin@NewPassword99!',
    });
    assert(newLoginRes.status === 200, 'Login with new password succeeds');

    // Reset password back to default for test determinism
    const resetBackRes = await makeRequest('/auth/change-password', 'POST', {
      currentPassword: 'Admin@NewPassword99!',
      newPassword: 'Admin@123456',
    }, newLoginRes.body.data?.accessToken);
    assert(resetBackRes.status === 200, 'Reset password back to standard seed password');

    // 13. Data Scope Query Helper Unit Verification
    console.log('\n--- 13. Data Scope Query Helper Verification ---');
    const mockSuperAdmin: AuthenticatedUser = {
      id: 'u1',
      email: 'admin@erp.local',
      firstName: 'Super',
      lastName: 'Admin',
      roleId: 'role-super-admin',
      roleName: 'super_admin',
      roles: ['super_admin'],
      companyId: 'company-default',
      permissions: ['*'],
    };
    const adminScope = buildDataScopeClause(mockSuperAdmin, 'tasks', 't');
    assert(adminScope.whereClause === '1=1', 'Super Admin gets 1=1 global scope for tasks');

    const mockEmployee: AuthenticatedUser = {
      id: 'u2',
      email: 'emp@erp.local',
      firstName: 'Jane',
      lastName: 'Doe',
      roleId: 'role-employee',
      roleName: 'employee',
      roles: ['employee'],
      employeeId: 'emp-101',
      companyId: 'company-default',
      permissions: ['tasks.view'],
    };
    const empScope = buildDataScopeClause(mockEmployee, 'tasks', 't');
    assert(empScope.whereClause === 't.assigned_employee_id = ?' && empScope.params[0] === 'emp-101', 'Employee gets own task filter (t.assigned_employee_id = emp-101)');

    const mockClient: AuthenticatedUser = {
      id: 'u3',
      email: 'client@corp.com',
      firstName: 'Acme',
      lastName: 'Client',
      roleId: 'role-client',
      roleName: 'client',
      roles: ['client'],
      clientId: 'cli-88',
      companyId: 'company-default',
      permissions: ['projects.view'],
    };
    const clientScope = buildDataScopeClause(mockClient, 'projects', 'p');
    assert(clientScope.whereClause === 'p.client_id = ?' && clientScope.params[0] === 'cli-88', 'Client gets isolated client_id filter (p.client_id = cli-88)');

    // 14. Logout
    console.log('\n--- 14. Logout Flow ---');
    const logoutRes = await makeRequest('/auth/logout', 'POST', {}, newLoginRes.body.data?.accessToken);
    assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds and clears session');

    console.log('\n===============================================================');
    console.log(`PHASE 1 SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('===============================================================');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runPhase1Tests();
