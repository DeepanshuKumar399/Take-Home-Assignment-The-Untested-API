const taskService = require('../src/services/taskService');

beforeEach(() => taskService._reset());

describe('create', () => {
  test('creates task with minimum valid input', () => {
    const task = taskService.create({ title: 'Test' });
    expect(task).toMatchObject({
      title: 'Test',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  test('applies provided fields over defaults', () => {
    const task = taskService.create({ title: 'T', status: 'in_progress', priority: 'high', description: 'desc' });
    expect(task).toMatchObject({ status: 'in_progress', priority: 'high', description: 'desc' });
  });
});

describe('getAll', () => {
  test('returns empty array initially', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  test('returns all created tasks', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
  });

  test('returns only tasks matching exact status', () => {
    const results = taskService.getByStatus('todo');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('A');
  });

  test('does not return partial status matches', () => {
    // Bug: original uses .includes() — "in" would match "in_progress"
    const results = taskService.getByStatus('in_progress');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('B');
  });

  test('returns empty array for unknown status', () => {
    expect(taskService.getByStatus('nonexistent')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) taskService.create({ title: `Task ${i}` });
  });

  test('page 1 with limit 2 returns first two tasks', () => {
    const results = taskService.getPaginated(1, 2);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Task 1');
  });

  test('page 2 with limit 2 returns tasks 3 and 4', () => {
    const results = taskService.getPaginated(2, 2);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Task 3');
  });

  test('last page returns remaining tasks', () => {
    const results = taskService.getPaginated(3, 2);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Task 5');
  });
});

describe('update', () => {
  test('updates existing task fields', () => {
    const task = taskService.create({ title: 'Original' });
    const updated = taskService.update(task.id, { title: 'Updated', priority: 'high' });
    expect(updated).toMatchObject({ title: 'Updated', priority: 'high' });
  });

  test('returns null for missing task', () => {
    expect(taskService.update('nonexistent-id', { title: 'X' })).toBeNull();
  });
});

describe('remove', () => {
  test('removes existing task and returns true', () => {
    const task = taskService.create({ title: 'To delete' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  test('returns false for missing task', () => {
    expect(taskService.remove('nonexistent-id')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and records completedAt', () => {
    const task = taskService.create({ title: 'T' });
    const completed = taskService.completeTask(task.id);
    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  test('does not reset priority when completing a task', () => {
    // Bug: original implementation resets priority to 'medium'
    const task = taskService.create({ title: 'T', priority: 'high' });
    const completed = taskService.completeTask(task.id);
    expect(completed.priority).toBe('high');
  });

  test('returns null for missing task', () => {
    expect(taskService.completeTask('nonexistent-id')).toBeNull();
  });

  test('completing an already-completed task updates completedAt again', () => {
    const task = taskService.create({ title: 'T' });
    const first = taskService.completeTask(task.id);
    const second = taskService.completeTask(task.id);
    expect(second.status).toBe('done');
    expect(second.completedAt).toBeDefined();
  });
});

describe('getStats', () => {
  test('returns zero counts and overdue=0 for empty store', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks by status correctly', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
    const stats = taskService.getStats();
    expect(stats).toMatchObject({ todo: 1, in_progress: 1, done: 1 });
  });

  test('counts overdue tasks (past dueDate, not done)', () => {
    taskService.create({ title: 'Overdue', status: 'todo', dueDate: '2000-01-01T00:00:00.000Z' });
    taskService.create({ title: 'Done overdue', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    const stats = taskService.getStats();
    expect(stats.overdue).toBe(1);
  });
});

describe('assignTask', () => {
  test('assigns a user to an existing task', () => {
    const task = taskService.create({ title: 'T' });
    const assigned = taskService.assignTask(task.id, 'Alice');
    expect(assigned.assignee).toBe('Alice');
  });

  test('trims whitespace from assignee', () => {
    const task = taskService.create({ title: 'T' });
    const assigned = taskService.assignTask(task.id, '  Bob  ');
    expect(assigned.assignee).toBe('Bob');
  });

  test('allows reassignment to a different user', () => {
    const task = taskService.create({ title: 'T' });
    taskService.assignTask(task.id, 'Alice');
    const reassigned = taskService.assignTask(task.id, 'Bob');
    expect(reassigned.assignee).toBe('Bob');
  });

  test('returns null for missing task', () => {
    expect(taskService.assignTask('nonexistent-id', 'Alice')).toBeNull();
  });
});
