import { query } from '../config/db';

const API = 'http://localhost:5000/api';

async function req(url: string, options: any = {}): Promise<{ status: number; ok: boolean; data: any }> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function testProjectsTasksSlice() {
  console.log('--- Starting Slice 3.5: Projects & Tasks E2E Test ---');

  // 1. Authenticate PM Lead
  const pmLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'pm.lead@erp.local', password: 'Admin@123456' },
  });
  const pmToken = pmLogin.data.data.token;
  const pmHeaders = { Authorization: `Bearer ${pmToken}` };
  console.log('✔ Authenticated as Project Manager');

  // 2. Authenticate Developer Employee
  const empLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'developer.employee@erp.local', password: 'Admin@123456' },
  });
  const empToken = empLogin.data.data.token;
  const empHeaders = { Authorization: `Bearer ${empToken}` };
  console.log('✔ Authenticated as Developer Employee');

  // 3. Authenticate Client
  const clientLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'client.contact@acmecorp.test', password: 'Admin@123456' },
  });
  const clientToken = clientLogin.data.data.token;
  const clientHeaders = { Authorization: `Bearer ${clientToken}` };
  console.log('✔ Authenticated as Client');

  // Get Client & Employee DB IDs
  const clientRows = await query<any[]>('SELECT id FROM clients WHERE client_code = "CLI-ACME-001"');
  const clientId = clientRows[0].id;
  const empRows = await query<any[]>('SELECT id FROM employees WHERE employee_id = "EMP-0007"');
  const empId = empRows[0].id;

  // Clean old test project if any
  await query('DELETE FROM projects WHERE project_code = "PRJ-TEST-API-01"');

  // 4. Create Project
  console.log('4. Creating Project...');
  const projRes = await req(`${API}/projects`, {
    method: 'POST',
    headers: pmHeaders,
    body: {
      projectCode: 'PRJ-TEST-API-01',
      name: 'Automated Test Cloud Migration',
      clientId,
      description: 'Full stack AWS serverless cloud migration project',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      budget: 750000.00,
      priority: 'high',
      status: 'active',
      memberIds: [empId],
    },
  });
  if (!projRes.ok) throw new Error(`Project creation failed: ${JSON.stringify(projRes.data)}`);
  const projectId = projRes.data.data.id;
  console.log(`✔ Created Project: ${projectId}`);

  // 5. Create Task
  console.log('5. Creating Task assigned to Developer Employee...');
  const taskRes = await req(`${API}/tasks`, {
    method: 'POST',
    headers: pmHeaders,
    body: {
      taskCode: 'TSK-TEST-001',
      title: 'Setup ECS Fargate Terraform Templates',
      description: 'Define infrastructure as code modules for staging and production',
      projectId,
      assignedEmployeeId: empId,
      priority: 'high',
      status: 'todo',
      dueDate: '2026-10-20',
      estimatedHours: 16.0,
      checklists: [
        { title: 'VPC and Subnet Module' },
        { title: 'ECS Task Definition Module' },
        { title: 'Application Load Balancer Module' },
      ],
    },
  });
  if (!taskRes.ok) throw new Error(`Task creation failed: ${JSON.stringify(taskRes.data)}`);
  const taskId = taskRes.data.data.id;
  console.log(`✔ Created Task: ${taskId}`);

  // 6. Developer Employee Updates Task Status & Adds Comment
  console.log('6. Developer updating task to in_progress and adding comment...');
  const updateTaskRes = await req(`${API}/tasks/${taskId}`, {
    method: 'PUT',
    headers: empHeaders,
    body: {
      status: 'in_progress',
      actualHours: 4.0,
    },
  });
  if (!updateTaskRes.ok) throw new Error(`Task update failed: ${JSON.stringify(updateTaskRes.data)}`);

  const commentRes = await req(`${API}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: empHeaders,
    body: { comment: 'Terraform VPC configuration completed and linted.' },
  });
  if (!commentRes.ok) throw new Error(`Comment failed: ${JSON.stringify(commentRes.data)}`);
  console.log('✔ Developer employee successfully updated task and added comment');

  // 7. Client Portal Verifies Project & Tasks
  console.log('7. Client checking project & task visibility in client portal...');
  const clientProjRes = await req(`${API}/projects/${projectId}`, {
    headers: clientHeaders,
  });
  if (!clientProjRes.ok) throw new Error(`Client project view failed: ${JSON.stringify(clientProjRes.data)}`);
  const clientProj = clientProjRes.data.data;
  if (clientProj.tasks.length === 0 || clientProj.tasks[0].id !== taskId) {
    throw new Error('Client cannot view tasks on their project');
  }
  console.log(`✔ Client verified project "${clientProj.name}" and task "${clientProj.tasks[0].title}"`);

  // Cleanup
  await query('DELETE FROM task_comments WHERE task_id = ?', [taskId]);
  await query('DELETE FROM task_checklists WHERE task_id = ?', [taskId]);
  await query('DELETE FROM tasks WHERE id = ?', [taskId]);
  await query('DELETE FROM project_members WHERE project_id = ?', [projectId]);
  await query('DELETE FROM projects WHERE id = ?', [projectId]);

  console.log('--- SLICE 3.5 (PROJECTS & TASKS) PASSED ALL TESTS ---');
  process.exit(0);
}

testProjectsTasksSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
