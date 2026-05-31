import { Router } from 'express'

import authRoutes from '#modules/auth/auth.route.js'
import eventRoutes from '#modules/events/event.route.js'
import githubRoutes from '#modules/github/github.route.js'
import googleRoutes from '#modules/google/google.route.js'
import notificationRoutes from '#modules/notifications/notification.route.js'
import teamRoutes from '#modules/teams/team.route.js'
import trackRoutes from '#modules/tracks/track.route.js'
import userRoutes from '#modules/users/user.route.js'
import workshopRoutes from '#modules/workshops/workshop.route.js'

const router = Router()

router.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

router.use('/auth', authRoutes)
router.use('/events', eventRoutes)
router.use('/github', githubRoutes)
router.use('/google', googleRoutes)
router.use('/notifications', notificationRoutes)
router.use('/teams', teamRoutes)
router.use('/tracks', trackRoutes)
router.use('/users', userRoutes)
router.use('/workshops', workshopRoutes)

export default router
