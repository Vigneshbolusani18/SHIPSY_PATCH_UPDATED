import './globals.css';

export const metadata = { title: 'SHIPSY' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/30 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 flex h-14 items-center justify-between">
       <a
  href="/"
  className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-400 bg-clip-text text-transparent tracking-wide drop-shadow-lg hover:scale-[1.02] transition-transform"
>
Smart Freight & Storage Planner
</a>


            <nav className="flex items-center gap-3 text-sm">
              <a href="/login" className="btn btn-ghost">Login</a>
              <a href="/register" className="btn btn-primary">Sign up</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-[rgb(var(--muted))]">
          Built for the Shipsy assignment
        </footer>
      </body>
    </html>
  );
}
