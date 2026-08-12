const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const taskSchema = new mongoose.Schema(
  {
    taskId: { type: String, unique: true, index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: [3, 'Title must be at least 3 characters'] },
    description: { type: String, trim: true, default: '' },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], default: 'PENDING' },
    
    // Legacy field for backward compatibility
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    // New flexible assignment structure
    assignmentType: { type: String, enum: ['DIRECT_DEVELOPER', 'TEAM_LEAD'], default: 'DIRECT_DEVELOPER' },
    teamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedDevelopers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    dueDate: { type: Date, default: null },
    estimatedHours: { type: Number, min: 0, default: 0 },
    tags: [{ type: String, trim: true }],
    attachments: [
      {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        mimetype: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

taskSchema.pre('validate', function (next) {
  if (this.isNew && !this.taskId) {
    this.taskId = uuidv4();
  }
  next();
});

taskSchema.index({ status: 1, priority: 1, assignedTo: 1, teamLead: 1, dueDate: -1 });
taskSchema.index({ assignmentType: 1, teamLead: 1, assignedDevelopers: 1 });

module.exports = mongoose.model('Task', taskSchema);
