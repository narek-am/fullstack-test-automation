function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  const status = err.status || 500;
  if (status >= 500) {
    // Never leak stack traces or SQL to the client.
    console.error(err);
    return res.status(status).json({ error: 'Internal server error' });
  }
  return res.status(status).json({ error: err.message, field: err.field });
}

module.exports = { notFound, errorHandler };
