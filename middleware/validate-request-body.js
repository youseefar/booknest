function isValidRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;

  return Object.values(body).every(value => {
    if (typeof value === 'string') return value.length <= 10000;
    if (typeof value === 'number') return Number.isFinite(value);
    return typeof value === 'boolean' || value === null;
  });
}

function validateRequestBody(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method) || req.path === '/payments/paystack/webhook') {
    return next();
  }

  const body = req.body || {};
  if (!isValidRequestBody(body)) {
    const error = new Error('Request body must contain only simple form values.');
    error.status = 400;
    return next(error);
  }

  return next();
}

module.exports = validateRequestBody;
