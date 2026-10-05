/**
 * Texts asserted by the tests. UI texts come from the English locale
 * (`psmusic.client/public/locales/en/translation.json`); server messages are
 * Vietnamese literals regardless of UI language (`AuthService.cs`, `AuthController.cs`).
 */
export const uiText = {
  loginSuccess: 'Login successful',
  fillAllFields: 'Please fill in all information',
  passwordTooShort: 'Password must be at least 8 characters',
} as const;

export const serverMessage = {
  loginSuccess: 'Đăng nhập thành công',
  unknownUsername: 'Tài khoản không tồn tại',
  wrongPassword: 'Sai mật khẩu',
  refreshSuccess: 'Refresh thành công',
  logoutSuccess: 'Đăng xuất thành công',
} as const;
