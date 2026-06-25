import { Router } from 'express'
import { StatusCodes } from 'http-status-codes'
import Joi from 'joi'

import adminMediaRoutes from '#modules/media/admin-media.route.js'
import auditLogRoutes from '#modules/audit-logs/audit-log.route.js'
import authRoutes from '#modules/auth/auth.route.js'
import aiReviewRoutes from '#modules/ai-reviews/ai-review.route.js'
import eventRoutes from '#modules/events/event.route.js'
import githubRoutes from '#modules/github/github.route.js'
import githubWebhookRoutes from '#modules/github-webhooks/github-webhook.route.js'
import googleRoutes from '#modules/google/google.route.js'
import judgingBoardRoutes from '#modules/judging-boards/judging-board.route.js'
import mediaRoutes from '#modules/media/media.route.js'
import notificationRoutes from '#modules/notifications/notification.route.js'
import operationsRoutes from '#modules/operations/operations.route.js'
import participantRoutes from '#modules/participants/participant.route.js'
import repositoryRoutes from '#modules/repositories/repository.route.js'
import resultRoutes from '#modules/results/result.route.js'
import roundRoutes from '#modules/rounds/round.route.js'
import rubricRoutes from '#modules/rubrics/rubric.route.js'
import scoreSheetRoutes from '#modules/score-sheets/score-sheet.route.js'
import submissionRoutes from '#modules/submissions/submission.route.js'
import teamRoutes from '#modules/teams/team.route.js'
import timelineRoutes from '#modules/timelines/timeline.route.js'
import trackRoutes from '#modules/tracks/track.route.js'
import userRoutes from '#modules/users/user.route.js'
import workshopRoutes from '#modules/workshops/workshop.route.js'
import rankingRoutes from '#modules/rankings/ranking.route.js'
import finalistRoutes from '#modules/finalists/finalist.route.js'
import permissionRoutes from '#modules/permissions/permission.route.js'
import roleRoutes from '#modules/roles/role.route.js'
import { EMAIL_SERVICE } from '#modules/notifications/email.service.js'
import { validationHandlingMiddleware } from '#middlewares/validationHandlingMiddleware.js'
import { responseSuccess } from '#utils/responseUtil.js'

const router = Router()

const testEmailValidation = {
  body: Joi.object({
    to: Joi.string().email().trim().lowercase().required()
  })
}

const sendTestEmail = async (req, res, next) => {
  try {
    const result = await EMAIL_SERVICE.sendEmail({
      to: req.body.to,
      subject: 'SEAL Hackathon test email',
      text: 'This is a test email from SEAL Hackathon via Resend.',
      html: '<p>This is a test email from <strong>SEAL Hackathon</strong> via Resend.</p>',
      metadata: {
        source: 'test-email-endpoint'
      }
    })

    res.status(result.sent ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json(responseSuccess({
      message: result.sent ? 'Send test email successfully' : 'Test email was not sent',
      data: result
    }))
  } catch (error) {
    next(error)
  }
}

router.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

router.post('/test-email', validationHandlingMiddleware(testEmailValidation), sendTestEmail)

router.use('/admin/media', adminMediaRoutes)
router.use('/audit-logs', auditLogRoutes)
router.use('/ai-reviews', aiReviewRoutes)
router.use('/auth', authRoutes)
router.use('/events', eventRoutes)
router.use('/github/webhooks', githubWebhookRoutes)
router.use('/github', githubRoutes)
router.use('/google', googleRoutes)
router.use('/judging-boards', judgingBoardRoutes)
router.use('/media', mediaRoutes)
router.use('/notifications', notificationRoutes)
router.use('/operations', operationsRoutes)
router.use('/participants', participantRoutes)
router.use('/finalists', finalistRoutes)
router.use('/rankings', rankingRoutes)
router.use('/repositories', repositoryRoutes)
router.use('/results', resultRoutes)
router.use('/rounds', roundRoutes)
router.use('/rubrics', rubricRoutes)
router.use('/score-sheets', scoreSheetRoutes)
router.use('/submissions', submissionRoutes)
router.use('/teams', teamRoutes)
router.use('/timelines', timelineRoutes)
router.use('/tracks', trackRoutes)
router.use('/users', userRoutes)
router.use('/workshops', workshopRoutes)
router.use('/permissions', permissionRoutes)
router.use('/roles', roleRoutes)

export default router
