function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? Date.parse(value) : NaN;
}

function evaluateDelay(order, thresholdMinutes) {
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes < 0 || thresholdMinutes > 1440) {
    throw new RangeError('Próg musi być liczbą od 0 do 1440 minut.');
  }
  const planned = timestamp(order.plannedAt);
  const eta = timestamp(order.eta);
  const enoughData = order.etaReliable === true && Number.isFinite(planned) && Number.isFinite(eta);
  const delayMinutes = enoughData ? Math.max(0, (eta - planned) / 60000) : null;
  const atRisk = enoughData && delayMinutes > thresholdMinutes;
  return {
    ...order, delayMinutes, status: !enoughData ? 'missing_data' : atRisk ? 'at_risk' : 'on_time',
    notification: atRisk && !order.decision ? { id: `delay-${order.id}`, orderId: order.id,
      message: `Ryzyko opóźnienia: ${order.id}` } : null,
  };
}
module.exports = { evaluateDelay, timestamp };
