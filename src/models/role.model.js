import mongoose from 'mongoose'

const { Schema } = mongoose

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission' }]
  },
  { timestamps: true }
)

const Role = mongoose.model('Role', roleSchema)

export default Role
