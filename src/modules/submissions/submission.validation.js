import Joi from 'joi'

const objectId = Joi.string().hex().length(24)
const submissionStatus = Joi.string().trim().uppercase().valid('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED')

export const SUBMISSION_VALIDATION = {
  listSubmissions: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
      eventId: objectId,
      roundId: objectId,
      teamId: objectId,
      repositoryId: objectId,
      status: submissionStatus
    })
  },
  createSubmission: {
    body: Joi.object({
      eventId: objectId.required(),
      roundId: objectId.required(),
      teamId: objectId.required(),
      repositoryId: objectId.allow(null),
      demoUrl: Joi.string().uri().allow('', null),
      reportUrl: Joi.string().uri().allow('', null),
      presentationUrl: Joi.string().uri().allow('', null),
      status: submissionStatus.default('DRAFT')
    })
  },
  getSubmissionById: {
    params: Joi.object({
      id: objectId.required()
    })
  },
  updateSubmission: {
    params: Joi.object({
      id: objectId.required()
    }),
    body: Joi.object({
      repositoryId: objectId.allow(null),
      demoUrl: Joi.string().uri().allow('', null),
      reportUrl: Joi.string().uri().allow('', null),
      presentationUrl: Joi.string().uri().allow('', null)
    }).min(1)
  },
  submitSubmission: {
    params: Joi.object({
      id: objectId.required()
    })
  },
  updateSubmissionStatus: {
    params: Joi.object({
      id: objectId.required()
    }),
    body: Joi.object({
      status: submissionStatus.required()
    })
  }
}
