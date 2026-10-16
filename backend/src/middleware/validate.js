import ApiError from '../utils/ApiError.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Please check the submitted fields.', result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))));
    }
    req.validatedBody = result.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Please check the query parameters.', result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))));
    }
    req.validatedQuery = result.data;
    return next();
  };
}
