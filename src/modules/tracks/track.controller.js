import { StatusCodes } from 'http-status-codes'

import { TRACK_SERVICE } from './track.service.js'
import { responseSuccess } from '#utils/responseUtil.js'

const listTracks = async (req, res, next) => {
  try {
    const { tracks, pagination } = await TRACK_SERVICE.listTracks(req.validated?.query || req.query, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get tracks successfully',
      data: tracks,
      pagination
    }))
  } catch (error) {
    next(error)
  }
}

const getTrackById = async (req, res, next) => {
  try {
    const track = await TRACK_SERVICE.getTrackById(req.params.id, req.user)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Get track successfully',
      data: track
    }))
  } catch (error) {
    next(error)
  }
}

const createTrack = async (req, res, next) => {
  try {
    const track = await TRACK_SERVICE.createTrack(req.body)

    res.status(StatusCodes.CREATED).json(responseSuccess({
      message: 'Create track successfully',
      data: track
    }))
  } catch (error) {
    next(error)
  }
}

const updateTrack = async (req, res, next) => {
  try {
    const track = await TRACK_SERVICE.updateTrack(req.params.id, req.body)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Update track successfully',
      data: track
    }))
  } catch (error) {
    next(error)
  }
}

const deleteTrack = async (req, res, next) => {
  try {
    await TRACK_SERVICE.deleteTrack(req.params.id)

    res.status(StatusCodes.OK).json(responseSuccess({
      message: 'Delete track successfully',
      data: null
    }))
  } catch (error) {
    next(error)
  }
}

export const TRACK_CONTROLLER = {
  listTracks,
  getTrackById,
  createTrack,
  updateTrack,
  deleteTrack
}
