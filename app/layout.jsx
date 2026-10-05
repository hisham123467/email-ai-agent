import './globals.css';

export const metadata = {
  title: 'Email AI Agent',
  description: 'Manual email control + ChatGPT MCP control from one backend.',
  applicationName: 'Email AI Agent',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Email AI Agent'
  }
};

export const viewport = {
  themeColor: '#11110f',
  colorScheme: 'light'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
