const ALLOWED_DB = ['fore_odoo_17', 'staging'];

const FILE = JSON.parse(open('./env.json'));

function cfg(key, fallback) {
  if (__ENV[key] !== undefined && __ENV[key] !== '') return __ENV[key];
  if (FILE[key] !== undefined && FILE[key] !== '') return FILE[key];
  return fallback;
}

const companyEnv = cfg('ODOO_COMPANY_ID', '');

export const CONFIG = {
  baseUrl:     cfg('ODOO_BASE_URL', 'http://localhost:8069').replace(/\/+$/, ''),
  db:          cfg('ODOO_DB', ''),
  login:       cfg('ODOO_LOGIN', 'admin'),
  apiKey:      cfg('ODOO_API_KEY', ''),
  companyId:   companyEnv ? Number(companyEnv) : null,
  timeout:     cfg('ODOO_TIMEOUT', '120s'),
  searchTerm:  cfg('SEARCH_TERM', ''),
  searchLimit: Number(cfg('SEARCH_LIMIT', 80)),
  runLabel:    cfg('RUN_LABEL', 'default'),
};

const db = String(CONFIG.db).toLowerCase();
if (!ALLOWED_DB.some((s) => db.includes(s))) {
  throw new Error(
    `Refusing to run against DB '${CONFIG.db}'. The name must contain one of: ` +
      `${ALLOWED_DB.join(', ')}. Set ODOO_DB in env.json (or -e ODOO_DB=...).`
  );
}

export const LOAD = {
  vus:         Number(cfg('VUS', 1)),
  iterations:  cfg('ITERATIONS', '') ? Number(cfg('ITERATIONS', '')) : undefined,
  duration:    cfg('DURATION', '') || undefined,
  // cap for the whole run; default 60m so heavy reports aren't cut off at k6's 10m default
  maxDuration: cfg('MAX_DURATION', '60m'),
};

export function loadOptions(extraThresholds = {}) {
  // Use a scenarios block so maxDuration is configurable (the vus+iterations
  // shorthand forces k6's 10m default and can't override it).
  const scenario = LOAD.duration
    ? { executor: 'constant-vus', vus: LOAD.vus, duration: LOAD.duration }
    : { executor: 'shared-iterations', vus: LOAD.vus, iterations: LOAD.iterations || 1, maxDuration: LOAD.maxDuration };
  return {
    scenarios: { default: scenario },
    thresholds: Object.assign(
      {
        checks:          ['rate>0.99'],
        http_req_failed: ['rate<0.01'],
        odoo_rpc_errors: ['count==0'],
      },
      extraThresholds
    ),
  };
}
