import { defineConfig } from 'allure';

// Allure 3 report settings, used by `npm run allure:generate` locally and in CI.
// singleFile: the report is one HTML file that opens straight from a downloaded artifact.
export default defineConfig({
  name: 'PSMusic Automation',
  output: './allure-report',
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: 'en',
      },
    },
  },
});
