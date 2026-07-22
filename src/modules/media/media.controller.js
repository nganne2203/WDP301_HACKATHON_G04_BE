import { StatusCodes } from 'http-status-codes'

import { MEDIA_SERVICE } from './media.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const getStorageConfig = async (req, res, next) => {
  try {
    const config = await MEDIA_SERVICE.getStorageConfig()

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get media storage configuration successfully',
      data: config
    }))
  } catch (error) {
    next(error)
  }
}

const saveStorageConfig = async (req, res, next) => {
  try {
    const config = await MEDIA_SERVICE.saveStorageConfig(req.body, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Save media storage configuration successfully',
      data: config
    }))
  } catch (error) {
    next(error)
  }
}

const uploadMedia = async (req, res, next) => {
  try {
    const media = await MEDIA_SERVICE.uploadMedia(req.body, req.file, req.user)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Upload media successfully',
      data: media
    }))
  } catch (error) {
    next(error)
  }
}

const listMyHistory = async (req, res, next) => {
  try {
    const { media, pagination } = await MEDIA_SERVICE.listMyHistory(req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get media upload history successfully',
      data: media,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getCompetitionGallery = async (req, res, next) => {
  try {
    const gallery = await MEDIA_SERVICE.getCompetitionGallery(req.params.id, req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get competition gallery successfully',
      data: gallery
    }))
  } catch (error) {
    next(error)
  }
}

const getSignedUrl = async (req, res, next) => {
  try {
    const signedUrl = await MEDIA_SERVICE.getSignedUrl(req.params.mediaId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Generate media signed URL successfully',
      data: signedUrl
    }))
  } catch (error) {
    next(error)
  }
}

const deleteMedia = async (req, res, next) => {
  try {
    await MEDIA_SERVICE.deleteMedia(req.params.mediaId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete media successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

const listAdminMedia = async (req, res, next) => {
  try {
    const { media, pagination } = await MEDIA_SERVICE.listAdminMedia(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get media successfully',
      data: media,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const approveMedia = async (req, res, next) => {
  try {
    const media = await MEDIA_SERVICE.approveMedia(req.params.mediaId, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Approve media successfully',
      data: media
    }))
  } catch (error) {
    next(error)
  }
}

const rejectMedia = async (req, res, next) => {
  try {
    const media = await MEDIA_SERVICE.rejectMedia(req.params.mediaId, req.body.reason, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Reject media successfully',
      data: media
    }))
  } catch (error) {
    next(error)
  }
}

const getStatistics = async (req, res, next) => {
  try {
    const statistics = await MEDIA_SERVICE.getStatistics(req.validated?.query || req.query)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get media statistics successfully',
      data: statistics
    }))
  } catch (error) {
    next(error)
  }
}

export const MEDIA_CONTROLLER = {
  getStorageConfig,
  saveStorageConfig,
  uploadMedia,
  listMyHistory,
  getCompetitionGallery,
  getSignedUrl,
  deleteMedia,
  listAdminMedia,
  approveMedia,
  rejectMedia,
  getStatistics
}
