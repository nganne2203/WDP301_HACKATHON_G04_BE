import Event from '#models/event.model.js'
import Workshop from '#models/workshop.model.js'
import WorkshopQuestion from '#models/workshopQuestion.model.js'
import WorkshopFeedback from '#models/workshopFeedback.model.js'
import WorkshopRating from '#models/workshopRating.model.js'
import Participant from '#models/participant.model.js'

const workshopPopulate = [
  { path: 'eventId', select: 'title seriesName season year status' },
  { path: 'presenterId', select: 'fullName email' }
]

const questionPopulate = [
  { path: 'authorId', select: 'fullName email' },
  { path: 'votes.voterId', select: 'fullName email' }
]

const interactionPopulate = [
  { path: 'authorId', select: 'fullName email' }
]

const countWorkshops = async (filter = {}) => {
  return await Workshop.countDocuments(filter)
}

const createWorkshop = async (data) => {
  return await Workshop.create(data)
}

const findWorkshops = async ({ filter = {}, skip = 0, limit = 10, sort = { startTime: 1, createdAt: -1 } } = {}) => {
  return await Workshop.find(filter)
    .populate(workshopPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const findWorkshopById = async (id) => {
  return await Workshop.findById(id).populate(workshopPopulate)
}

const updateWorkshopById = async (id, data) => {
  return await Workshop.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  }).populate(workshopPopulate)
}

const updateWorkshopGoogleMeet = async (id, googleMeet) => {
  return await Workshop.findByIdAndUpdate(
    id,
    {
      meetLink: googleMeet.meetLink,
      googleMeet
    },
    {
      new: true,
      runValidators: true
    }
  ).populate(workshopPopulate)
}

const deleteWorkshopById = async (id) => {
  return await Workshop.findByIdAndDelete(id)
}

const deleteWorkshopInteractions = async (workshopId) => {
  await Promise.all([
    WorkshopQuestion.deleteMany({ workshopId }),
    WorkshopRating.deleteMany({ workshopId }),
    WorkshopFeedback.deleteMany({ workshopId })
  ])
}

const findEventById = async (id) => {
  return await Event.findById(id)
}

const findEventIdsForParticipant = async (userId) => {
  return await Participant.find({ userId, status: 'JOINED' }).distinct('eventId')
}

const findOpenRegistrationEventIds = async (now = new Date()) => {
  return await Event.find({
    status: 'OPEN_REGISTRATION',
    $and: [
      { $or: [{ registrationStart: { $exists: false } }, { registrationStart: null }, { registrationStart: { $lte: now } }] },
      { $or: [{ registrationEnd: { $exists: false } }, { registrationEnd: null }, { registrationEnd: { $gte: now } }] }
    ]
  }).distinct('_id')
}

const findNonDraftEventIds = async () => {
  return await Event.find({ status: { $ne: 'DRAFT' } }).distinct('_id')
}

const findJoinedParticipant = async ({ eventId, userId }) => {
  return await Participant.findOne({ eventId, userId, status: 'JOINED' })
}

const createQuestion = async (data) => {
  const question = await WorkshopQuestion.create(data)
  return await WorkshopQuestion.findById(question._id).populate(questionPopulate)
}

const findQuestions = async ({ filter = {}, skip = 0, limit = 10, sort = { voteCount: -1, createdAt: -1 } } = {}) => {
  return await WorkshopQuestion.find(filter)
    .populate(questionPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const countQuestions = async (filter = {}) => {
  return await WorkshopQuestion.countDocuments(filter)
}

const findQuestionById = async (id) => {
  return await WorkshopQuestion.findById(id).populate(questionPopulate)
}

const voteQuestion = async ({ questionId, voterId }) => {
  return await WorkshopQuestion.findOneAndUpdate(
    {
      _id: questionId,
      'votes.voterId': { $ne: voterId }
    },
    {
      $push: { votes: { voterId } },
      $inc: { voteCount: 1 }
    },
    { new: true, runValidators: true }
  ).populate(questionPopulate)
}

const createRating = async (data) => {
  const rating = await WorkshopRating.create(data)
  return await WorkshopRating.findById(rating._id).populate(interactionPopulate)
}

const findRatingByAuthor = async ({ workshopId, authorId }) => {
  return await WorkshopRating.findOne({ workshopId, authorId })
}

const findRatings = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await WorkshopRating.find(filter)
    .populate(interactionPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const countRatings = async (filter = {}) => {
  return await WorkshopRating.countDocuments(filter)
}

const getRatingStats = async (workshopId) => {
  const [stats = null] = await WorkshopRating.aggregate([
    { $match: { workshopId } },
    {
      $group: {
        _id: '$workshopId',
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ])

  return stats || { averageRating: 0, totalRatings: 0 }
}

const createFeedback = async (data) => {
  const feedback = await WorkshopFeedback.create(data)
  return await WorkshopFeedback.findById(feedback._id).populate(interactionPopulate)
}

const findFeedbackByAuthor = async ({ workshopId, authorId }) => {
  return await WorkshopFeedback.findOne({ workshopId, authorId })
}

const findFeedback = async ({ filter = {}, skip = 0, limit = 10, sort = { createdAt: -1 } } = {}) => {
  return await WorkshopFeedback.find(filter)
    .populate(interactionPopulate)
    .sort(sort)
    .skip(skip)
    .limit(limit)
}

const countFeedback = async (filter = {}) => {
  return await WorkshopFeedback.countDocuments(filter)
}

export const WORKSHOP_REPOSITORY = {
  countWorkshops,
  createWorkshop,
  findWorkshops,
  findWorkshopById,
  updateWorkshopById,
  updateWorkshopGoogleMeet,
  deleteWorkshopById,
  deleteWorkshopInteractions,
  findEventById,
  findEventIdsForParticipant,
  findOpenRegistrationEventIds,
  findNonDraftEventIds,
  findJoinedParticipant,
  createQuestion,
  findQuestions,
  countQuestions,
  findQuestionById,
  voteQuestion,
  createRating,
  findRatingByAuthor,
  findRatings,
  countRatings,
  getRatingStats,
  createFeedback,
  findFeedbackByAuthor,
  findFeedback,
  countFeedback
}
