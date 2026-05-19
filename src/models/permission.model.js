import mongoose from 'mongoose'

const { Schema } = mongoose

const permissionSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String }
  },
  { timestamps: true }
)

permissionSchema.index({ code: 1 }, { unique: true })

const Permission = mongoose.model('Permission', permissionSchema)

export default Permission
