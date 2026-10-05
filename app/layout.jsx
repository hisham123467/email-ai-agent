import './globals.css';

export const metadata = {
  title: 'Email AI Agent',
  description: 'Manual email control + ChatGPT MCP control from one backend.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
