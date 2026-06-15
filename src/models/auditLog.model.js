import mongoose from 'mongoose'

const { Schema } = mongoose

const auditLogSchema = new Schema(
  {
    auditId: { type: String, trim: true, unique: true, sparse: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, trim: true },
    userRole: { type: String, trim: true },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.Mixed },
    resourceType: { type: String },
    resourceId: { type: Schema.Types.Mixed },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    description: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String, trim: true },
    sessionId: { type: String, trim: true },
    result: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
    errorMessage: { type: String },
    sourceModule: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
)

auditLogSchema.index({ userId: 1, createdAt: 1 })
auditLogSchema.index({ resourceType: 1, resourceId: 1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ result: 1, createdAt: -1 })
auditLogSchema.index({ requestId: 1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

export default AuditLog
