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

async function testPerformanceSlice() {
  console.log('--- Starting Slice 3.7: Performance Reviews E2E Test ---');

  // 1. Authenticate PM Lead (Reviewer)
  const pmLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'pm.lead@erp.local', password: 'Admin@123456' },
  });
  const pmHeaders = { Authorization: `Bearer ${pmLogin.data.data.token}` };
  console.log('✔ Authenticated as PM Lead (Manager)');

  // 2. Authenticate Developer Employee
  const empLogin = await req(`${API}/auth/login`, {
    method: 'POST',
    body: { email: 'developer.employee@erp.local', password: 'Admin@123456' },
  });
  const empHeaders = { Authorization: `Bearer ${empLogin.data.data.token}` };
  console.log('✔ Authenticated as Developer Employee');

  const empRows = await query<any[]>('SELECT id FROM employees WHERE employee_id = "EMP-0007"');
  const empId = empRows[0].id;

  // 3. Manager Submits Performance Review
  console.log('3. Manager submitting performance review for employee...');
  const createReviewRes = await req(`${API}/performance`, {
    method: 'POST',
    headers: pmHeaders,
    body: {
      employeeId: empId,
      cycle: 'quarterly',
      period: 'Q3 2026',
      taskCompletionRating: 4.8,
      qualityRating: 4.5,
      productivityRating: 4.7,
      attendanceRating: 5.0,
      communicationRating: 4.2,
      teamworkRating: 4.6,
      technicalRating: 4.9,
      managerFeedback: 'Consistently demonstrates strong architectural problem-solving and rapid delivery.',
      strengths: 'Typescript, backend workflows, debugging complex race conditions.',
      areasForImprovement: 'Could take more initiative in cross-team sprint syncs.',
      goals: 'Lead delivery of cloud migration milestone in Q4.',
    },
  });
  if (!createReviewRes.ok) throw new Error(`Create review failed: ${JSON.stringify(createReviewRes.data)}`);
  const reviewId = createReviewRes.data.data.id;
  const overallScore = createReviewRes.data.data.overallScore;
  console.log(`✔ Submitted Review: ${reviewId} (Overall Score: ${overallScore}/5.0)`);

  // 4. Employee Views Performance Review
  console.log('4. Employee viewing own performance review...');
  const getEmpReviewsRes = await req(`${API}/performance?myReviews=true`, {
    headers: empHeaders,
  });
  if (!getEmpReviewsRes.ok) throw new Error(`Get reviews failed: ${JSON.stringify(getEmpReviewsRes.data)}`);
  const reviews = getEmpReviewsRes.data.data;
  const foundReview = reviews.find((r: any) => r.id === reviewId);
  if (!foundReview) throw new Error('Employee could not find submitted review');
  console.log(`✔ Employee successfully viewed review for ${foundReview.period}: Rating=${foundReview.overall_score}, Feedback="${foundReview.manager_feedback}"`);

  // Cleanup
  await query('DELETE FROM performance_reviews WHERE id = ?', [reviewId]);

  console.log('--- SLICE 3.7 (PERFORMANCE REVIEWS) PASSED ALL TESTS ---');
}

testPerformanceSlice().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
