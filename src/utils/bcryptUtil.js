import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

const hashPassword = async (plainPassword) => {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS)
}

const comparePassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword)
}

export const BCRYPT_UTILS = {
  hashPassword,
  comparePassword
}