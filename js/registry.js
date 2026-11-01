// Click/change handlers registered by each module, dispatched by main.js.
// Kept dependency-free so view modules can import it without import cycles.
export const actions = {};
export const changes = {};
export const hooks = { rerender: () => {}, navigate: () => {} };

export function registerActions(map) { Object.assign(actions, map); }
export function registerChanges(map) { Object.assign(changes, map); }
export const rerender = () => hooks.rerender();
export const navigate = (route, params) => hooks.navigate(route, params);

// Per-view UI state that survives re-renders and route changes.
export const ui = {
  pcTab: 'schedule',
  pcMonth: '',
  pcDay: '',
  pcQuery: '',
  pcStatus: 'all',
  admDate: '',
  admDept: 'all',
  admQuery: '',
  admExpanded: false,
  fuDate: '',
  fuShow: 'all',
  fuQuery: '',
  tbFilter: 'all',
  tbQuery: '',
  clMonth: '',
  clDay: '',
  clDoctor: 'all',
  calMonth: '',
  calDay: '',
};
