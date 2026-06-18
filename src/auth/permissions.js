export const roleDescriptions = {
  Admin: 'Acesso total administrativo',
  RH: 'RH com aprovação final bloqueada',
  Líder: 'Liderança com registros para conferência',
};

const permissionMap = {
  Admin: [
    'dashboard:view',
    'employees:view',
    'employees:create',
    'employees:edit',
    'employees:delete',
    'employees:salaries',
    'employees:finance',
    'employees:full-history',
    'employees:scores',
    'occurrences:create',
    'occurrences:review',
    'occurrences:approve',
    'rh:view',
    'rh:approve',
    'leadership:view',
    'admin:view',
    'orders:view',
    'notices:view',
    'finance:view',
    'clients:view',
    'clients:edit',
    'users:view',
    'users:edit',
    'time:view',
    'settings:view',
    'settings:edit',
  ],
  RH: [
    'dashboard:view',
    'employees:view',
    'employees:create',
    'employees:edit',
    'employees:full-history',
    'employees:scores',
    'occurrences:create',
    'occurrences:review',
    'rh:view',
    'rh:recommend',
    'leadership:view',
    'admin:view',
    'orders:view',
    'notices:view',
    'clients:view',
    'settings:view',
  ],
  Líder: [
    'dashboard:view',
    'leadership:view',
    'occurrences:create',
    'orders:view',
    'notices:view',
  ],
};

const routeRoles = [
  { test: /^\/documentos(\/.*)?$/, roles: ['Admin', 'RH'] },
  { test: /^\/relatorios$/, roles: ['Admin', 'RH'] },
  { test: /^\/dashboard$/, roles: ['Admin', 'RH', 'Líder'] },
  { test: /^\/funcionarios(\/.*)?$/, roles: ['Admin', 'RH'] },
  { test: /^\/ocorrencias\/nova$/, roles: ['Admin', 'RH', 'Líder'] },
  { test: /^\/rh$/, roles: ['Admin', 'RH'] },
  { test: /^\/lideranca(\/.*)?$/, roles: ['Admin', 'RH', 'Líder'] },
  { test: /^\/administracao$/, roles: ['Admin', 'RH'] },
  { test: /^\/administracao\/pedidos$/, roles: ['Admin', 'RH', 'Líder'] },
  { test: /^\/administracao\/avisos$/, roles: ['Admin', 'RH', 'Líder'] },
  { test: /^\/administracao\/(pendencias|revisoes)$/, roles: ['Admin', 'RH'] },
  { test: /^\/financeiro(\/.*)?$/, roles: ['Admin'] },
  { test: /^\/clientes(\/.*)?$/, roles: ['Admin', 'RH'] },
  { test: /^\/usuarios(\/.*)?$/, roles: ['Admin'] },
  { test: /^\/meu-ponto$/, roles: ['Admin', 'RH', 'Líder'] },
  { test: /^\/configuracoes$/, roles: ['Admin', 'RH'] },
];

export function hasPermission(role, permission) {
  return permissionMap[role]?.includes(permission) ?? false;
}

export function canAccessRoute(role, pathname) {
  const route = routeRoles.find((item) => item.test.test(pathname));
  return route ? route.roles.includes(role) : false;
}

export function filterByRole(items, role) {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}
