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
  const directMatch = await Repository.findOne({ repositoryFullName })
  if (directMatch) return directMatch

  const [owner, repo] = String(repositoryFullName || '').split('/')
  if (!owner || !repo) return null

  return await Repository.findOne({
    $or: [
      { githubOwner: owner, githubRepo: repo },
      { githubOrg: owner, repoName: repo }
    ]
  })
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
