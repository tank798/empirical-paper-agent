const path = require('path');

module.exports = {
  content: [
    path.join(__dirname, 'apps/web/app/**/*.{ts,tsx}'),
    path.join(__dirname, 'apps/web/components/**/*.{ts,tsx}'),
    path.join(__dirname, 'apps/web/lib/**/*.{ts,tsx}')
  ],
  theme: {
    extend: {
      colors: {
        ink: '#101820',
        sand: '#f6f1e8',
        moss: '#6d7f5f',
        rust: '#bb6a3d',
        mist: '#d8e2dc'
      },
      boxShadow: {
        card: '0 24px 60px rgba(16, 24, 32, 0.08)'
      }
    }
  },
  plugins: []
};
