export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function fail(status, code, message) {
  throw new ApiError(status, code, message);
}
export function notFound() {
  fail(404, 'NOT_FOUND', 'Record not found');
}
export function checkVersion(row, version) {
  if (row.version !== version) fail(409, 'VERSION_CONFLICT', 'Record changed. Reload before retrying.');
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status;
  let code = error.code;
  let message = error.message;
  if (!(error instanceof ApiError)) {
    status = 500; code = 'INTERNAL_ERROR'; message = 'Something went wrong';
    if (error.type === 'entity.parse.failed') {
      status = 400; code = 'INVALID_JSON'; message = 'Request body must be valid JSON';
    } else if (error.type === 'entity.too.large') {
      status = 413; code = 'BODY_TOO_LARGE'; message = 'Request body is too large';
    } else if (['encoding.unsupported','charset.unsupported'].includes(error.type)) {
      status = 415; code = 'UNSUPPORTED_ENCODING'; message = 'Use uncompressed UTF-8 JSON';
    } else if (error.code === '23505') {
      status = 409; code = 'DUPLICATE_RECORD'; message = 'A conflicting record already exists';
    } else if (['23514', '23503', '23502', '22P02'].includes(error.code)) {
      status = 422; code = 'VALIDATION_FAILED'; message = 'The operation violates a data rule';
    } else if (['40P01', '40001', '55P03'].includes(error.code)) {
      status = 409; code = 'CONCURRENT_CHANGE'; message = 'Concurrent change. Reload before retrying.';
    } else if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', '57P01', '53300', '57014', '08006', '08001'].includes(error.code)) {
      status = 503; code = 'DEPENDENCY_UNAVAILABLE'; message = 'Service temporarily unavailable';
    }
  }
  res.status(status).json({ error: { code, message }, requestId: req.requestId });
}
