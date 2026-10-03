#!/usr/bin/env bash
# Create .env from .env.example (or add settings that a newer .env.example introduced),
# replacing __GENERATE_*__ placeholders with random values. Never overwrites existing values.
set -euo pipefail

example=".env.example"
target=".env"

random_hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }

generate() {
  case "$1" in
    __GENERATE_HEX__) random_hex 16 ;;
    __GENERATE_SECRET__) random_hex 32 ;;
    # Letters and digits only, so it satisfies the password policy and needs no quoting.
    __GENERATE_PASSWORD__) printf 'Cavi%s7' "$(random_hex 5)" ;;
    *) printf '%s' "$1" ;;
  esac
}

created=false
[[ -f "${target}" ]] || { : > "${target}"; created=true; }

added=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  if [[ "${line}" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    if grep -q "^${key}=" "${target}"; then
      continue
    fi
    printf '%s=%s\n' "${key}" "$(generate "${value}")" >> "${target}"
    added+=("${key}")
  elif ${created}; then
    printf '%s\n' "${line}" >> "${target}"
  fi
done < "${example}"

if ${created}; then
  echo "Created .env with freshly generated secrets."
elif ((${#added[@]})); then
  echo "Added new settings to .env: ${added[*]}"
fi

if ${created} || [[ " ${added[*]-} " == *" ADMIN_PASSWORD "* ]]; then
  admin_email="$(grep '^ADMIN_EMAIL=' "${target}" | cut -d= -f2-)"
  admin_password="$(grep '^ADMIN_PASSWORD=' "${target}" | cut -d= -f2-)"
  echo "First administrator sign-in: ${admin_email} / ${admin_password}"
  echo "(stored in .env; you will be asked to choose a new password at first sign-in)"
fi
