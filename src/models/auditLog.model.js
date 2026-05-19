import mongoose from 'mongoose'

const { Schema } = mongoose

const auditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
)

auditLogSchema.index({ userId: 1, createdAt: 1 })
auditLogSchema.index({ resourceType: 1, resourceId: 1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

export default AuditLog
