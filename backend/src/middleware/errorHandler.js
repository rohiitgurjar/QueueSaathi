import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { config } from '../config/env.js';

export function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'The requested API route was not found.'));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let normalized = error;
  if (error?.type === 'entity.parse.failed') {
    normalized = new ApiError(400, 'INVALID_JSON', 'Request body must contain valid JSON.');
  } else if (error instanceof mongoose.Error.ValidationError) {
    normalized = new ApiError(400, 'VALIDATION_ERROR', 'The submitted data is invalid.');
  } else if (error instanceof mongoose.Error.CastError) {
    normalized = new ApiError(400, 'INVALID_ID', 'A resource identifier is invalid.');
  } else if (error?.code === 11000) {
    normalized = new ApiError(409, 'DUPLICATE_RESOURCE', 'A record with those details already exists.');
  }

  const status = Number.isInteger(normalized.status) ? normalized.status : 500;
  const response = {
    error: {
      code: normalized.code ?? 'INTERNAL_ERROR',
      message: status >= 500 && config.isProduction
        ? 'Something went wrong. Please try again.'
        : (normalized.message || 'Something went wrong.'),
    },
  };
  if (normalized.details) response.error.details = normalized.details;
  if (status >= 500 && !config.isProduction) response.error.debug = error.message;
  if (status >= 500) console.error(error);
  return res.status(status).json(response);
}
