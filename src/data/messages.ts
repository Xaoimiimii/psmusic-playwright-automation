/**
 * Texts asserted by the tests. UI texts come from the English locale
 * (`psmusic.client/public/locales/en/translation.json`); server messages are
 * Vietnamese literals regardless of UI language (`AuthService.cs`, `AuthController.cs`).
 */
export const uiText = {
  loginSuccess: 'Login successful',
  fillAllFields: 'Please fill in all information',
  passwordTooShort: 'Password must be at least 8 characters',
  songNotFound: 'Song not found',
  /** `no_lyrics_yet`: shown when a song has no lyric file, and also when the file cannot be fetched or parsed. */
  noLyrics: 'No lyrics available :(',
  showMore: 'Show More',
  showLess: 'Show Less',
  viewMore: 'View More',
  play: 'Play',
  pause: 'Pause',
  download: 'Download',
  /** Player bar volume button tooltip (`mute` / `unmute`); the button has no other accessible name. */
  mute: 'Mute',
  unmute: 'Unmute',
  artists: 'Artists',
  otherSongsBy: 'Other songs by',
  startListening: 'Start Listening',
  loginNow: 'Login Now',
  maybeLater: 'Maybe Later',
  /** `/recent` stub title, hard-coded Vietnamese in `App.jsx` (not translated). */
  recentPlaceholder: 'Nghe Gần Đây',
} as const;

export const serverMessage = {
  loginSuccess: 'Đăng nhập thành công',
  unknownUsername: 'Tài khoản không tồn tại',
  wrongPassword: 'Sai mật khẩu',
  refreshSuccess: 'Refresh thành công',
  logoutSuccess: 'Đăng xuất thành công',
  songNotFound: 'Không tìm thấy bài hát',
} as const;
