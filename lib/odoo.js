// Odoo external API client (JSON-RPC over /jsonrpc), API-key auth.
//   common.authenticate(db, login, key, {}) -> uid
//   object.execute_kw(db, uid, key, model, method, args, kwargs)
// Only public model methods are reachable here (no leading "_").
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';
import { CONFIG } from '../config.js';

// Bumped on any RPC failure. loadOptions sets a count==0 threshold on it so a
// real server error fails the run (slow-but-working calls don't).
const rpcErrors = new Counter('odoo_rpc_errors');

let _rpcId = 0;

function rpc(service, method, args) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method:  'call',
    id:      (_rpcId += 1),
    params:  { service, method, args },
  });
  return http.post(`${CONFIG.baseUrl}/jsonrpc`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags:    { rpc_method: method },
    timeout: CONFIG.timeout,
  });
}

// Parse the JSON-RPC envelope and blow up with a readable message on errors.
function unwrap(res, context) {
  if (res.status !== 200) {
    rpcErrors.add(1);
    fail(`[${context}] HTTP ${res.status}: ${String(res.body).slice(0, 300)}`);
  }
  let body;
  try {
    body = res.json();
  } catch (e) {
    rpcErrors.add(1);
    fail(`[${context}] non-JSON response: ${String(res.body).slice(0, 300)}`);
  }
  if (body && body.error) {
    rpcErrors.add(1);
    const data = body.error.data || {};
    const msg = data.message || body.error.message || 'unknown error';
    const dbg = (data.debug || '').split('\n').slice(-3).join(' | ');
    fail(`[${context}] ${msg} ${dbg}`);
  }
  return body ? body.result : undefined;
}

let _uid = null;

// Authenticate once per VU, cache the uid.
export function login() {
  if (_uid) return _uid;
  const uid = unwrap(rpc('common', 'authenticate', [CONFIG.db, CONFIG.login, CONFIG.apiKey, {}]), 'authenticate');
  const ok = check(uid, { 'authenticate: uid returned': (u) => Number.isInteger(u) && u > 0 });
  if (!ok) fail(`Login failed for ${CONFIG.login}@${CONFIG.db}. Check ODOO_API_KEY / db.`);
  _uid = uid;
  return uid;
}

// Force every call to run in CONFIG.companyId (if set) by pinning
// allowed_company_ids in the context. env.company then resolves to that company.
function withCompany(kwargs) {
  if (!CONFIG.companyId) return kwargs;
  const context = Object.assign({}, kwargs.context, { allowed_company_ids: [CONFIG.companyId] });
  return Object.assign({}, kwargs, { context });
}

// model.method(*args, **kwargs). For instance methods, args[0] is the id list:
//   callKw('account.move', 'action_post', [[moveId]])
export function callKw(model, method, args = [], kwargs = {}) {
  if (_uid === null) login();
  return unwrap(rpc('object', 'execute_kw', [CONFIG.db, _uid, CONFIG.apiKey, model, method, args, withCompany(kwargs)]), `${model}.${method}`);
}

// callKw that returns { ok, value, error } instead of aborting on failure.
export function callKwSafe(model, method, args = [], kwargs = {}) {
  if (_uid === null) login();
  const res = rpc('object', 'execute_kw', [CONFIG.db, _uid, CONFIG.apiKey, model, method, args, withCompany(kwargs)]);
  if (res.status !== 200) return { ok: false, value: undefined, error: `HTTP ${res.status}` };
  let body;
  try {
    body = res.json();
  } catch (e) {
    return { ok: false, value: undefined, error: 'non-JSON response' };
  }
  if (body && body.error) {
    const data = body.error.data || {};
    return { ok: false, value: undefined, error: data.message || body.error.message || 'rpc error' };
  }
  return { ok: true, value: body ? body.result : undefined, error: null };
}

export function searchRead(model, domain = [], fields = ['id'], opts = {}) {
  return callKw(model, 'search_read', [], {
    domain:  domain,
    fields:  fields,
    limit:   opts.limit || 0,
    offset:  opts.offset || 0,
    order:   opts.order || '',
    context: opts.context || {},
  });
}

// What the list views / search bar use. specification picks the fields, e.g.
//   { name: {}, partner_id: { fields: { display_name: {} } } }
export function webSearchRead(model, domain = [], specification = { id: {} }, opts = {}) {
  return callKw(model, 'web_search_read', [], {
    domain:        domain,
    specification: specification,
    offset:        opts.offset || 0,
    limit:         opts.limit || CONFIG.searchLimit,
    order:         opts.order || '',
    count_limit:   opts.countLimit || 10001,
    context:       opts.context || {},
  });
}

// module.name -> record id, or null.
export function xmlIdToResId(module, name) {
  const rows = searchRead('ir.model.data', [['module', '=', module], ['name', '=', name]], ['res_id'], { limit: 1 });
  return rows && rows.length ? rows[0].res_id : null;
}
