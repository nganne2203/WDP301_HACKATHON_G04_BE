import mongoose from 'mongoose'

const { Schema } = mongoose

const submissionSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
    roundId: { type: Schema.Types.ObjectId, ref: 'Round', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository' },
    demoUrl: { type: String },
    reportUrl: { type: String },
    presentationUrl: { type: String },
    submittedAt: { type: Date },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'],
      default: 'DRAFT'
    }
  },
  { timestamps: true }
)

submissionSchema.index({ roundId: 1, teamId: 1 }, { unique: true })
submissionSchema.index({ submittedAt: 1 })

const Submission = mongoose.model('Submission', submissionSchema)

export default Submission
