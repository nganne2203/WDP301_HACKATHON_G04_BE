import mongoose from 'mongoose'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    googleId: { type: String },
    googleAuth: {
      googleId: { type: String },
      email: { type: String, lowercase: true, trim: true },
      name: { type: String, trim: true },
      picture: { type: String }
    },
    googleCalendar: {
      connected: { type: Boolean, default: false },
      googleId: { type: String },
      email: { type: String, lowercase: true, trim: true },
      accessToken: { type: String },
      refreshToken: { type: String },
      tokenExpiryDate: { type: Date },
      scope: [{ type: String }]
    },
    authProvider: {
      type: String,
      enum: ['GOOGLE', 'LOCAL'],
      default: 'LOCAL'
    },
    passwordHash: { type: String },
    mustChangePassword: { type: Boolean, default: false },
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
userSchema.index({ 'googleAuth.googleId': 1 }, { unique: true, sparse: true })
userSchema.index({ 'googleCalendar.connected': 1 })
userSchema.index({ roles: 1 })

const User = mongoose.model('User', userSchema)

export default User
