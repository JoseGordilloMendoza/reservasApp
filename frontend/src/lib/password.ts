// What the new password form checks before bothering the server. The server repeats the rules
// and adds the ones it alone can judge (too common, too like the email).

export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordErrors {
  password?: string;
  confirm?: string;
}

export function validateNewPassword(password: string, confirm: string): PasswordErrors {
  const errors: PasswordErrors = {};

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (/^\d+$/.test(password)) {
    errors.password = "No uses solo números.";
  }

  if (!errors.password && password !== confirm) errors.confirm = "Las contraseñas no coinciden.";
  return errors;
}
