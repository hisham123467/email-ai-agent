export default function manifest() {
  return {
    name: 'Email AI Agent',
    short_name: 'Email AI',
    description: 'Manual email control and ChatGPT-powered email operations.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f4ef',
    theme_color: '#11110f',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/maskable-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable'
      }
    ]
  };
}
