export function calculateAge(birthDate: string, now = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return 0
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return Math.max(0, age)
}

export function isGuardianConsentRequired(birthDate: string, now = new Date()) {
  return calculateAge(birthDate, now) < 14
}
