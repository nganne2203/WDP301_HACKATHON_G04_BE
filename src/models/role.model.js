import mongoose from 'mongoose'

const { Schema } = mongoose

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    code: { type: String, trim: true },
    description: { type: String },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }],
    isSystemRole: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

roleSchema.index({ code: 1 }, { unique: true, sparse: true })
roleSchema.index({ isActive: 1 })
roleSchema.index({ isSystemRole: 1 })

const Role = mongoose.model('Role', roleSchema)

export default Role
