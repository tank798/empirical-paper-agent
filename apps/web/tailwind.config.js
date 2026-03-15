module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  safelist: ['rounded-full', 'bg-slate-950', 'px-4', 'text-4xl', 'max-w-5xl', 'text-slate-600'],
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
