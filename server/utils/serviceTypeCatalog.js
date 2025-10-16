const MIN_EXPECTED_MINUTES = 5;
const MAX_EXPECTED_MINUTES = 480;
const MAX_SERVICE_TYPES = 32;

const DEFAULT_SERVICE_TYPES = [
  {
    id: 'express-detail',
    name: 'Express Detail',
    description: 'Rapid refresh for frontline vehicles and quick turnarounds.',
    expectedMinutes: 45,
    isActive: true
  },
  {
    id: 'full-detail',
    name: 'Full Detail',
    description: 'Comprehensive interior and exterior reconditioning service.',
    expectedMinutes: 120,
    isActive: true
  },
  {
    id: 'showroom-prep',
    name: 'Showroom Prep',
    description: 'Presentation-ready finish for showroom and delivery units.',
    expectedMinutes: 90,
    isActive: true
  },
  {
    id: 'delivery-clean',
    name: 'Delivery Clean',
    description: 'Final delivery bay wipe down with glass, tires, and floor mats.',
    expectedMinutes: 30,
    isActive: true
  }
];

function sanitizeText(value, fallback = '', maxLength = 120) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const sanitized = value.replace(/[<>]/g, '').trim();
  if (!sanitized) {
    return fallback;
  }
  return sanitized.slice(0, maxLength);
}

function clampExpectedMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 60;
  }
  const rounded = Math.round(numeric);
  if (rounded < MIN_EXPECTED_MINUTES) {
    return MIN_EXPECTED_MINUTES;
  }
  if (rounded > MAX_EXPECTED_MINUTES) {
    return MAX_EXPECTED_MINUTES;
  }
  return rounded;
}

function generateIdFromName(name, index) {
  const fallback = `service-${index + 1}`;
  const base = sanitizeText(name, fallback, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

function normalizeServiceType(entry = {}, index = 0, usedIds = new Set()) {
  const name = sanitizeText(entry.name || entry.label, `Service ${index + 1}`, 60);
  const description = sanitizeText(entry.description || entry.summary || '', '', 240);
  const expectedMinutes = clampExpectedMinutes(entry.expectedMinutes ?? entry.duration ?? entry.estimatedMinutes ?? 60);
  const isActive = entry.isActive !== false;

  let id = sanitizeText(entry.id || entry.key || '', '', 80)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  if (!id) {
    id = generateIdFromName(name, index);
  }

  let uniqueId = id;
  let counter = 1;
  while (usedIds.has(uniqueId) && counter < 20) {
    uniqueId = `${id}-${counter}`;
    counter += 1;
  }
  usedIds.add(uniqueId);

  return {
    id: uniqueId,
    name,
    description,
    expectedMinutes,
    isActive
  };
}

function ensureServiceTypeCatalog(value) {
  const usedIds = new Set();
  const candidateList = Array.isArray(value) ? value.slice(0, MAX_SERVICE_TYPES) : [];
  const sanitized = candidateList
    .map((entry, index) => normalizeServiceType(entry, index, usedIds))
    .filter((entry) => entry && entry.name);

  if (sanitized.length === 0) {
    return DEFAULT_SERVICE_TYPES.map((entry, index) => ({
      ...entry,
      id: entry.id || `default-${index}`
    }));
  }

  return sanitized;
}

module.exports = {
  DEFAULT_SERVICE_TYPES,
  ensureServiceTypeCatalog,
  MIN_EXPECTED_MINUTES,
  MAX_EXPECTED_MINUTES,
  MAX_SERVICE_TYPES
};
