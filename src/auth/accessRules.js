export const VINICIUS_PROFILE_ID = '9a3cacb3-ee0c-48ed-93cd-6adab7e60c0f';
export const GIRLANE_PROFILE_ID = 'ce8f51ee-837a-4e4f-9340-fe1835a5c97e';

const VINICIUS_EMAILS = ['vmirandasilvav@gmail.com', 'vmirandasilvay@gmail.com'];
const GIRLANE_EMAIL = 'giadmiluvig@gmail.com';

export function getTimeClockAccess(profile, user) {
  const email = (profile?.email || user?.email || '').toLocaleLowerCase('pt-BR');
  const hasStoredAccess = ['write', 'read', 'none'].includes(profile?.time_clock_access);
  const isVinicius = hasStoredAccess
    ? profile.time_clock_access === 'write'
    : profile?.id === VINICIUS_PROFILE_ID || VINICIUS_EMAILS.includes(email);
  const isGirlane = hasStoredAccess
    ? profile.time_clock_access === 'read'
    : (profile?.id === GIRLANE_PROFILE_ID || email === GIRLANE_EMAIL) && profile?.role === 'admin';
  return { canView: isVinicius || isGirlane, canWrite: isVinicius, isGirlane, isVinicius };
}
