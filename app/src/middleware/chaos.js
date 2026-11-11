// Fault injection used by the chaos-engineering experiments in cfr-tests/.
// Only mounted when CHAOS_ENABLED=true, never in a default start.
function createChaos() {
  const state = { latencyMs: 0, errorRate: 0, pathPrefix: '/api/' };

  function middleware(req, res, next) {
    if (!req.path.startsWith(state.pathPrefix) || req.path.startsWith('/api/health')) {
      return next();
    }
    const proceed = () => {
      if (state.errorRate > 0 && Math.random() < state.errorRate) {
        return res.status(503).json({ error: 'Injected fault (chaos experiment)' });
      }
      return next();
    };
    return state.latencyMs > 0 ? setTimeout(proceed, state.latencyMs) : proceed();
  }

  function controlRoute(req, res) {
    const { latencyMs = 0, errorRate = 0, pathPrefix = '/api/' } = req.body || {};
    if (!(latencyMs >= 0 && latencyMs <= 30_000) || !(errorRate >= 0 && errorRate <= 1)) {
      return res.status(400).json({ error: 'latencyMs must be 0-30000 and errorRate 0-1' });
    }
    Object.assign(state, { latencyMs, errorRate, pathPrefix });
    return res.json(state);
  }

  return { middleware, controlRoute, state };
}

module.exports = { createChaos };
