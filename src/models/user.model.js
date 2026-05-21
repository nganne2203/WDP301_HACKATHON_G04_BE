import mongoose from 'mongoose'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String },
    authProvider: {
      type: String,
      enum: ['GOOGLE', 'LOCAL'],
      default: 'GOOGLE'
    },
    passwordHash: { type: String },
    fullName: { type: String, required: true, trim: true },
    studentType: {
      type: String,
      enum: ['FPT', 'EXTERNAL']
    },
    studentId: { type: String, trim: true },
    schoolName: {
      type: String,
      trim: true,
      required: function () {
        return this.studentType === 'EXTERNAL'
      }
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING'
    },
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    avatarUrl: { type: String },
    phone: { type: String },
    bio: { type: String }
  },
  { timestamps: true }
)

userSchema.index({ googleId: 1 }, { unique: true, sparse: true })
userSchema.index({ roles: 1 })

const User = mongoose.model('User', userSchema)

export default User
