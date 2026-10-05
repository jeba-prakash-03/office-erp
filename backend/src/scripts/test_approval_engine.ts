import { query } from '../config/db';
import { ApprovalService } from '../services/approval.service';
import { v4 as uuidv4 } from 'uuid';

async function runApprovalTests() {
  console.log('--- Starting Approval Engine Tests ---');

  // Find Developer Employee (requester) and PM Lead (manager)
  const empRows = await query<any[]>('SELECT id, user_id FROM employees WHERE employee_id = "EMP-0007"');
  const pmRows = await query<any[]>('SELECT id, user_id FROM employees WHERE employee_id = "EMP-0005"');

  if (empRows.length === 0 || pmRows.length === 0) {
    throw new Error('Test employees EMP-0007 or EMP-0005 not found. Please run seed script.');
  }

  const requester = empRows[0];
  const manager = pmRows[0];
  const testLeaveId = 'test-leave-' + uuidv4().substring(0, 8);

  // 1. Submit approval request
  console.log('1. Submitting test approval request...');
  const requestId = await ApprovalService.submitRequest({
    entityType: 'leave',
    entityId: testLeaveId,
    requesterId: requester.id,
    currentApproverId: manager.id,
    comments: 'Annual leave test request',
    actorUserId: requester.user_id,
    actorRole: 'employee',
  });
  console.log(`Created Approval Request ID: ${requestId}`);

  // Verify in MySQL
  const reqCheck = await query<any[]>('SELECT * FROM approval_requests WHERE id = ?', [requestId]);
  if (reqCheck.length === 0 || reqCheck[0].status !== 'pending') {
    throw new Error(`Failed to verify approval request in DB: ${JSON.stringify(reqCheck)}`);
  }
  console.log('✔ Verified approval request persisted with status "pending"');

  // 2. Self-approval guard test
  console.log('2. Testing self-approval guard (Employee trying to approve own request)...');
  let selfApprovalBlocked = false;
  try {
    await ApprovalService.processDecision({
      requestId,
      action: 'approve',
      actorUserId: requester.user_id,
      actorEmployeeId: requester.id,
      actorRole: 'employee',
      remarks: 'Self approval attempt',
    });
  } catch (err: any) {
    if (err.code === 'SELF_APPROVAL_PROHIBITED' || err.statusCode === 403) {
      selfApprovalBlocked = true;
      console.log(`✔ Self-approval successfully blocked with code: ${err.code}`);
    } else {
      throw err;
    }
  }

  if (!selfApprovalBlocked) {
    throw new Error('FAILED: Self-approval was NOT blocked!');
  }

  // 3. Manager approval test
  console.log('3. Manager approving request...');
  const decisionResult = await ApprovalService.processDecision({
    requestId,
    action: 'approve',
    actorUserId: manager.user_id,
    actorEmployeeId: manager.id,
    actorRole: 'project_manager',
    remarks: 'Approved by manager',
  });

  if (decisionResult.newStatus !== 'approved') {
    throw new Error(`Expected approved status, got ${decisionResult.newStatus}`);
  }
  console.log('✔ Manager successfully approved request');

  // 4. Verify Approval History & Audit Trail
  const history = await ApprovalService.getHistory(requestId);
  console.log(`Approval history records: ${history.length}`);
  if (history.length < 2) {
    throw new Error(`Expected at least 2 history records (submit + approve), got ${history.length}`);
  }
  console.log('✔ Verified approval history audit trail');

  // 5. Verify Notification to Requester
  const notifs = await query<any[]>(
    'SELECT * FROM notifications WHERE user_id = ? AND type = "leave" ORDER BY created_at DESC LIMIT 1',
    [requester.user_id]
  );
  if (notifs.length === 0) {
    throw new Error('No notification created for requester upon approval');
  }
  console.log(`✔ Requester received notification: "${notifs[0].title}" - "${notifs[0].message}"`);

  // Clean up test approval request
  await query('DELETE FROM approval_history WHERE request_id = ?', [requestId]);
  await query('DELETE FROM approval_requests WHERE id = ?', [requestId]);
  await query('DELETE FROM notifications WHERE id = ?', [notifs[0].id]);

  console.log('--- ALL APPROVAL ENGINE TESTS PASSED ---');
  process.exit(0);
}

runApprovalTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
