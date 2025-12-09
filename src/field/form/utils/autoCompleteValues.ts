export const autoCompleteValues = {
  "name": "Name",
  "given-name": "Given name",
  "family-name": "Family name",
  "username": "Username",
  "nickname": "Nickname",

  "email": "Email",
  "new-password": "New password",
  "current-password": "Current password",
  "one-time-code": "One-time code",

  "tel": "Telephone",
  "street-address": "Street address",
  "address-line1": "Address line 1",
  "address-line2": "Address line 2",
  "postal-code": "Postal code",
  "country": "Country (code)",
  "country-name": "Country name",
  "address-level2": "City",
  "address-level1": "State / Province",

  "cc-number": "Credit card number",
  "cc-exp": "Credit card expiry (MM/YY)",
  "cc-exp-month": "Credit card expiry month",
  "cc-exp-year": "Credit card expiry year",

  // Extra commonly used values
  "organization": "Organization",
  "birthdate": "Birthdate",
  "bday-day": "Birthday (day)",
  "bday-month": "Birthday (month)",
  "bday-year": "Birthday (year)",
  "url": "Website URL",
  "sex": "Sex",
  "gender-identity": "Gender identity",

  // On/Off toggles
  "on": "Autocomplete on",
  "off": "Autocomplete off"
}

export function isAutoCompleteValue(value: string | undefined): value is keyof typeof autoCompleteValues {
  if(!value) return false
  return value in autoCompleteValues
}