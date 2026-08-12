const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, enum: ['TASK_CREATED', 'TASK_UPDATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNED_USER_CHANGED', 'TASK_DELETED', 'COMMENT_ADDED'] },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

activitySchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
