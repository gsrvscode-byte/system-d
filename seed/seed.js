require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
const taskTitles = [
  'Fix login page redirect loop',
  'Update API rate limiting config',
  'Resolve memory leak in worker process',
  'Add pagination to user list',
  'Fix broken avatar upload',
  'Implement dark mode toggle',
  'Refactor auth middleware',
  'Update dependencies to latest LTS',
  'Fix CORS error on production',
  'Add email notification template',
  'Resolve database connection timeout',
  'Add unit tests for task service',
  'Fix date formatting in dashboard',
  'Update role-based access logic',
  'Fix broken search filter',
  'Add batch import for users',
  'Resolve race condition in task assignment',
  'Fix incorrect overdue calculation',
  'Add audit log for user deletion',
  'Update password validation rules',
  'Fix missing error response on 404',
  'Add WebSocket support for real-time updates',
  'Resolve slow query on dashboard stats',
  'Add CSV export for tasks',
  'Fix incorrect user count on dashboard',
  'Update JWT expiry handling',
  'Add profile picture resize on upload',
  'Fix broken notification badge',
  'Implement task priority auto-sort',
  'Add soft delete for tasks',
];

const seed = async () => {
  await connectDB();

  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
    Activity.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  // --- Users ---
  console.log('Creating users...');
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@example.com',
    password: 'Password@123',
    role: 'ADMIN',
    phone: '+1-555-0100',
  });

  const teamLead1 = await User.create({
    name: 'Alice Johnson',
    email: 'teamlead1@example.com',
    password: 'Password@123',
    role: 'TEAM_LEAD',
    phone: '+1-555-0101',
    createdBy: admin._id,
  });

  const teamLead2 = await User.create({
    name: 'Bob Smith',
    email: 'teamlead2@example.com',
    password: 'Password@123',
    role: 'TEAM_LEAD',
    phone: '+1-555-0102',
    createdBy: admin._id,
  });

  const devNames = [
    ['Charlie Brown', 'developer1@example.com', '+1-555-0103'],
    ['Diana Prince', 'developer2@example.com', '+1-555-0104'],
    ['Evan Wright', 'developer3@example.com', '+1-555-0105'],
    ['Fiona Gallagher', 'developer4@example.com', '+1-555-0106'],
    ['George Miller', 'developer5@example.com', '+1-555-0107'],
  ];

  const developers = [];
  for (const [name, email, phone] of devNames) {
    const teamLead = developers.length % 2 === 0 ? teamLead1 : teamLead2;
    const dev = await User.create({
      name,
      email,
      password: 'Password@123',
      role: 'DEVELOPER',
      phone,
      teamLead: teamLead._id,
      createdBy: admin._id,
    });
    developers.push(dev);
  }

  // --- Tasks ---
  console.log('Creating 30 tasks...');
  const tasks = [];
  for (let i = 0; i < 30; i++) {
    const dev = developers[i % developers.length];
    const lead = i % 2 === 0 ? teamLead1 : teamLead2;
    const status = statuses[i % 3];
    const priority = priorities[i % 4];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (i - 10));

    const task = await Task.create({
      title: taskTitles[i],
      description: `Detailed description for task #${i + 1}: ${taskTitles[i]}. This task requires thorough investigation and testing before closing.`,
      priority,
      status,
      assignedTo: dev._id,
      assignedBy: lead._id,
      teamLead: lead._id,
      dueDate,
      estimatedHours: Math.floor(Math.random() * 16) + 2,
      tags: [`tag-${i % 5}`, `sprint-${i % 3}`],
    });
    tasks.push(task);

    await Activity.create({
      task: task._id,
      user: lead._id,
      action: 'TASK_CREATED',
      newValue: { title: task.title, status, priority },
    });
  }

  // --- Comments ---
  console.log('Creating comments...');
  const commentTexts = [
    'Started working on this, will update soon.',
    'Found the root cause, pushing a fix shortly.',
    'Need more info about the reproduction steps.',
    'This is blocked by another task.',
    'Fix is ready, pending review.',
  ];
  for (let i = 0; i < 20; i++) {
    const task = tasks[i % tasks.length];
    const dev = developers[i % developers.length];
    await Comment.create({
      task: task._id,
      user: dev._id,
      comment: commentTexts[i % commentTexts.length],
    });
  }

  // --- Notifications ---
  console.log('Creating notifications...');
  for (const dev of developers) {
    await Notification.create({
      user: dev._id,
      title: 'New Task Assigned',
      message: 'You have new tasks assigned. Check your dashboard.',
    });
    await Notification.create({
      user: dev._id,
      title: 'Deadline Reminder',
      message: 'You have a task due soon. Please check your task list.',
      isRead: Math.random() > 0.5,
    });
  }
  await Notification.create({
    user: teamLead1._id,
    title: 'Team Update',
    message: 'Your team has 5 pending tasks.',
  });
  await Notification.create({
    user: admin._id,
    title: 'System',
    message: 'All systems operational.',
  });

  console.log('\n=== Seed complete ===');
  console.log(`Users: ${await User.countDocuments()} (1 admin, 2 team leads, 5 developers)`);
  console.log(`Tasks: ${await Task.countDocuments()}`);
  console.log(`Comments: ${await Comment.countDocuments()}`);
  console.log(`Activities: ${await Activity.countDocuments()}`);
  console.log(`Notifications: ${await Notification.countDocuments()}`);
  console.log('\nLogin credentials:');
  console.log('  Admin:     admin@example.com / Password@123');
  console.log('  TeamLead1: teamlead1@example.com / Password@123');
  console.log('  TeamLead2: teamlead2@example.com / Password@123');
  console.log('  Dev1-5:    developer1-5@example.com / Password@123');

  mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
