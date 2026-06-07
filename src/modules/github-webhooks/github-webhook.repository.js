import GitHubWebhookEvent from '#models/githubWebhookEvent.model.js'
import Repository from '#models/repository.model.js'

const findDeliveryById = async (deliveryId) => {
  return await GitHubWebhookEvent.findOne({ deliveryId })
}

const createDelivery = async (data) => {
  return await GitHubWebhookEvent.create(data)
}

const updateDeliveryById = async (id, data) => {
  return await GitHubWebhookEvent.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  })
}

const findRepositoryByFullName = async (repositoryFullName) => {
  return await Repository.findOne({ repositoryFullName })
}

const updateRepositoryById = async (id, data) => {
  return await Repository.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true
  })
}

export const GITHUB_WEBHOOK_REPOSITORY = {
  findDeliveryById,
  createDelivery,
  updateDeliveryById,
  findRepositoryByFullName,
  updateRepositoryById
}
