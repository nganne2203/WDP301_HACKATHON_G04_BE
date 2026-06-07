import { Router } from 'express'

import adminMediaRoutes from '#modules/media/admin-media.route.js'
import authRoutes from '#modules/auth/auth.route.js'
import eventRoutes from '#modules/events/event.route.js'
import githubRoutes from '#modules/github/github.route.js'
import githubWebhookRoutes from '#modules/github-webhooks/github-webhook.route.js'
import googleRoutes from '#modules/google/google.route.js'
import judgingBoardRoutes from '#modules/judging-boards/judging-board.route.js'
import mediaRoutes from '#modules/media/media.route.js'
import notificationRoutes from '#modules/notifications/notification.route.js'
import participantRoutes from '#modules/participants/participant.route.js'
import repositoryRoutes from '#modules/repositories/repository.route.js'
import roundRoutes from '#modules/rounds/round.route.js'
import teamRoutes from '#modules/teams/team.route.js'
import timelineRoutes from '#modules/timelines/timeline.route.js'
import trackRoutes from '#modules/tracks/track.route.js'
import userRoutes from '#modules/users/user.route.js'
import workshopRoutes from '#modules/workshops/workshop.route.js'

const router = Router()

router.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

router.use('/admin/media', adminMediaRoutes)
router.use('/auth', authRoutes)
router.use('/events', eventRoutes)
router.use('/github/webhooks', githubWebhookRoutes)
router.use('/github', githubRoutes)
router.use('/google', googleRoutes)
router.use('/judging-boards', judgingBoardRoutes)
router.use('/media', mediaRoutes)
router.use('/notifications', notificationRoutes)
router.use('/participants', participantRoutes)
router.use('/repositories', repositoryRoutes)
router.use('/rounds', roundRoutes)
router.use('/teams', teamRoutes)
router.use('/timelines', timelineRoutes)
router.use('/tracks', trackRoutes)
router.use('/users', userRoutes)
router.use('/workshops', workshopRoutes)

export default router
