import express from 'express'

import ApiError from '#utils/ApiError.js'
import { ERROR_CODES } from '#constants/errorCode.js'

const MAX_UPLOAD_BODY = '210mb'
const HEADER_SEPARATOR = Buffer.from('\r\n\r\n')

const isMultipart = (req) => {
  return String(req.headers['content-type'] || '').toLowerCase().startsWith('multipart/form-data')
}

const parseHeaderValue = (headers, name) => {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, 'im')
  return headers.match(pattern)?.[1]?.trim()
}

const parseDisposition = (value = '') => {
  const result = {}
  const segments = value.split(';').map(segment => segment.trim())

  for (const segment of segments.slice(1)) {
    const [key, rawValue] = segment.split('=')
    if (!key) continue
    result[key] = String(rawValue || '').replace(/^"|"$/g, '')
  }

  return result
}

const parseMultipartBuffer = ({ body, boundary }) => {
  const delimiter = Buffer.from(`--${boundary}`)
  const fields = {}
  const files = []
  let cursor = body.indexOf(delimiter)

  while (cursor !== -1) {
    cursor += delimiter.length

    if (body[cursor] === 45 && body[cursor + 1] === 45) break
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2

    const nextDelimiter = body.indexOf(delimiter, cursor)
    if (nextDelimiter === -1) break

    let partEnd = nextDelimiter
    if (body[partEnd - 2] === 13 && body[partEnd - 1] === 10) {
      partEnd -= 2
    }

    const part = body.subarray(cursor, partEnd)
    const headerEnd = part.indexOf(HEADER_SEPARATOR)
    if (headerEnd === -1) {
      cursor = nextDelimiter
      continue
    }

    const headers = part.subarray(0, headerEnd).toString('utf8')
    const content = part.subarray(headerEnd + HEADER_SEPARATOR.length)
    const disposition = parseDisposition(parseHeaderValue(headers, 'Content-Disposition'))
    const fieldName = disposition.name
    const filename = disposition.filename
    const contentType = parseHeaderValue(headers, 'Content-Type')

    if (fieldName && filename !== undefined) {
      files.push({
        fieldname: fieldName,
        originalFileName: filename,
        mimeType: contentType || 'application/octet-stream',
        size: content.length,
        buffer: content
      })
    } else if (fieldName) {
      const value = content.toString('utf8')
      if (fields[fieldName] === undefined) {
        fields[fieldName] = value
      } else if (Array.isArray(fields[fieldName])) {
        fields[fieldName].push(value)
      } else {
        fields[fieldName] = [fields[fieldName], value]
      }
    }

    cursor = nextDelimiter
  }

  return { fields, files }
}

export const multipartBodyParser = express.raw({
  type: isMultipart,
  limit: MAX_UPLOAD_BODY
})

export const mediaMultipartMiddleware = (req, res, next) => {
  try {
    if (!isMultipart(req)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Request must be multipart/form-data'])
    }

    const contentType = String(req.headers['content-type'] || '')
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] ||
      contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2]

    if (!boundary) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Multipart boundary is missing'])
    }

    if (!Buffer.isBuffer(req.body)) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['Multipart body is missing'])
    }

    const { fields, files } = parseMultipartBuffer({ body: req.body, boundary })
    const file = files.find(item => item.fieldname === 'file')

    if (!file) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, ['file is required'])
    }

    req.body = fields
    req.file = file
    next()
  } catch (error) {
    next(error)
  }
}

export const MEDIA_MULTIPART = {
  multipartBodyParser,
  mediaMultipartMiddleware,
  parseMultipartBuffer
}
