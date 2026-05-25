import mongoose from 'mongoose'

const { Schema } = mongoose

const systemConfigurationSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    isEncrypted: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
)

const SystemConfiguration = mongoose.model('SystemConfiguration', systemConfigurationSchema)

export default SystemConfiguration
