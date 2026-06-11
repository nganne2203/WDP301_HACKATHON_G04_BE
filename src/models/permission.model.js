import mongoose from 'mongoose'

const { Schema } = mongoose

const permissionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, trim: true },
    description: { type: String },
    module: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

permissionSchema.index({ module: 1 })
permissionSchema.index({ isActive: 1 })

const Permission = mongoose.model('Permission', permissionSchema)

export default Permission
