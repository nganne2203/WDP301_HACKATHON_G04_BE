import { Router } from 'express'

import authRoutes from '#modules/auth/auth.route.js'
import eventRoutes from '#modules/events/event.route.js'
import trackRoutes from '#modules/tracks/track.route.js'
import userRoutes from '#modules/users/user.route.js'

const router = Router()

router.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

router.use('/auth', authRoutes)
router.use('/events', eventRoutes)
router.use('/tracks', trackRoutes)
router.use('/users', userRoutes)

export default router
