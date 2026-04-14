const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => taskService._reset());

// ── GET /tasks ────────────────────────────────────────────────────────────────

describe('GET /tasks', () => {
  test('returns empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'A' });
    await request(app).post('/tasks').send({ title: 'B' });
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'done' });
    const res = await request(app).get('/tasks?status=todo');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A');
  });

  test('paginates results — page 1 returns first items', async () => {
    for (let i = 1; i <= 5; i++) await request(app).post('/tasks').send({ title: `Task ${i}` });
    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task 1');
  });

  test('paginates results — page 2 returns next items', async () => {
    for (let i = 1; i <= 5; i++) await request(app).post('/tasks').send({ title: `Task ${i}` });
    const res = await request(app).get('/tasks?page=2&limit=2');
    expect(res.body[0].title).toBe('Task 3');
  });
});

// ── POST /tasks ───────────────────────────────────────────────────────────────

describe('POST /tasks', () => {
  test('creates a task with minimum valid input', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', status: 'todo', priority: 'medium' });
    expect(res.body.id).toBeDefined();
  });

  test('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'high' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid status', async () => {
    const res = await request(app).post('/tasks').send({ title: 'T', status: 'pending' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid priority', async () => {
    const res = await request(app).post('/tasks').send({ title: 'T', priority: 'urgent' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid dueDate', async () => {
    const res = await request(app).post('/tasks').send({ title: 'T', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});

// ── PUT /tasks/:id ────────────────────────────────────────────────────────────

describe('PUT /tasks/:id', () => {
  test('updates an existing task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });
    const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: 'Updated', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Updated', priority: 'high' });
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app).put('/tasks/nonexistent-id').send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid status in update', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app).put(`/tasks/${created.body.id}`).send({ status: 'in-progress' });
    expect(res.status).toBe(400);
  });
});

// ── DELETE /tasks/:id ─────────────────────────────────────────────────────────

describe('DELETE /tasks/:id', () => {
  test('deletes an existing task and returns 204', async () => {
    const created = await request(app).post('/tasks').send({ title: 'To delete' });
    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app).delete('/tasks/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ── PATCH /tasks/:id/complete ─────────────────────────────────────────────────

describe('PATCH /tasks/:id/complete', () => {
  test('marks a task as done and sets completedAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('does not reset priority when completing', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T', priority: 'high' });
    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  test('returns 404 for non-existent task', async () => {
    const res = await request(app).patch('/tasks/nonexistent-id/complete');
    expect(res.status).toBe(404);
  });
});

// ── GET /tasks/stats ──────────────────────────────────────────────────────────

describe('GET /tasks/stats', () => {
  test('returns zero counts for empty store', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks by status', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'in_progress' });
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toMatchObject({ todo: 1, in_progress: 1, done: 0 });
  });

  test('counts overdue tasks correctly', async () => {
    await request(app).post('/tasks').send({ title: 'Overdue', dueDate: '2000-01-01T00:00:00.000Z' });
    const res = await request(app).get('/tasks/stats');
    expect(res.body.overdue).toBe(1);
  });
});

// ── PATCH /tasks/:id/assign ───────────────────────────────────────────────────

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a user to an existing task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
  });

  test('trims whitespace from assignee', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: '  Bob  ' });
    expect(res.body.assignee).toBe('Bob');
  });

  test('returns 400 when assignee is missing', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 when assignee is empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: '   ' });
    expect(res.status).toBe(400);
  });

  test('returns 404 when task does not exist', async () => {
    const res = await request(app).patch('/tasks/nonexistent-id/assign').send({ assignee: 'Alice' });
    expect(res.status).toBe(404);
  });

  test('allows reassignment to a different user', async () => {
    const created = await request(app).post('/tasks').send({ title: 'T' });
    await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Alice' });
    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });
});
