import test from 'node:test';
import assert from 'node:assert/strict';
import { getTimeClockAccess, GIRLANE_PROFILE_ID, VINICIUS_PROFILE_ID } from './accessRules.js';

test('33. permissão write dá leitura e escrita', () => assert.deepEqual(getTimeClockAccess({ time_clock_access: 'write' }, null).canWrite, true));
test('34. permissão read dá somente leitura', () => { const access = getTimeClockAccess({ time_clock_access: 'read' }, null); assert.equal(access.canView, true); assert.equal(access.canWrite, false); });
test('35. permissão none bloqueia até e-mail conhecido', () => assert.equal(getTimeClockAccess({ time_clock_access: 'none', email: 'vmirandasilvav@gmail.com' }, null).canView, false));
test('36. fallback de Vinícius existe antes da migration', () => assert.equal(getTimeClockAccess({ id: VINICIUS_PROFILE_ID }, null).canWrite, true));
test('37. fallback de Girlane continua somente leitura', () => { const access = getTimeClockAccess({ id: GIRLANE_PROFILE_ID, role: 'admin' }, null); assert.equal(access.canView, true); assert.equal(access.canWrite, false); });
test('38. RH sem permissão específica não vê Meu Ponto', () => assert.equal(getTimeClockAccess({ role: 'rh', time_clock_access: 'none' }, null).canView, false));
test('39. Líder sem permissão específica não vê Meu Ponto', () => assert.equal(getTimeClockAccess({ role: 'lider', time_clock_access: 'none' }, null).canView, false));
