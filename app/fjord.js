(function (root) {
  'use strict';
  const observed = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  function distance(a, b) {
    if (![a?.la, a?.lo, b?.la, b?.lo].every(Number.isFinite)) return Infinity;
    const rad = Math.PI / 180;
    const h = Math.sin((b.la - a.la) * rad / 2) ** 2 +
      Math.cos(a.la * rad) * Math.cos(b.la * rad) * Math.sin((b.lo - a.lo) * rad / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  }
  function summarize(locations, anchorId, radius, weeks) {
    const anchor = locations.find(l => l.n === anchorId);
    if (!anchor || ![10, 20, 30, 50].includes(radius)) return null;
    const neighbors = locations.filter(l => l.n !== anchorId && l.lf !== false)
      .map(l => ({ l, d: distance(anchor, l) })).filter(x => x.d <= radius)
      .sort((a, b) => a.d - b.d || a.l.n - b.l.n);
    const reported = neighbors.filter(x => observed(x.l.lus));
    return {
      anchor, neighbors, reported: reported.length, total: neighbors.length,
      mean: reported.length ? reported.reduce((sum, x) => sum + x.l.lus, 0) / reported.length : null,
      over: reported.filter(x => observed(x.l.gr) && x.l.lus >= x.l.gr).length,
      trend: weeks.map((week, i) => {
        const values = neighbors.map(x => x.l.hist?.[i]).filter(observed);
        return { ...week, reported: values.length, total: neighbors.length,
          mean: values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null };
      }),
    };
  }
  function suppliers(catalog, county, category = 'all') {
    const normalize = s => String(s || '').trim().toLocaleLowerCase('nb-NO');
    const area = normalize(county);
    return catalog.filter(s => Array.isArray(s.dekning) &&
      s.dekning.some(d => normalize(d) === 'noreg' || (area && normalize(d) === area)) &&
      (category === 'all' || s.kategoriar.includes(category)));
  }
  root.OppdretterFjord = Object.freeze({ distance, summarize, suppliers });
})(typeof window === 'undefined' ? globalThis : window);
