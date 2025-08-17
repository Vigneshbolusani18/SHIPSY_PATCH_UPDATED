import "./globals.css";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";
import { prisma } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";

export const metadata = { title: "SHIPSY" };

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070a0e",
  colorScheme: "dark",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  let user = null;
  if (token) {
    try {
      const payload = verifyJWT(token); // { sub, username }
      user = await prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      user = null;
    }
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Preload frequent backgrounds */}
        <link rel="preload" as="image" href="/login.webp" />
        <link rel="preload" as="image" href="/register.jpg" />
        <link rel="preload" as="image" href="/bg.jpg" />
      </head>

      {/* add has-dynamic-bg so CSS is ready before any page sets vars */}
      <body className="has-dynamic-bg min-h-screen bg-[rgb(7,10,14)] text-white antialiased">
        {/* Header */}
       <header className="sticky top-0 z-50 bg-[rgb(7,10,14)]/20 backdrop-blur-md border-b border-white/5">  
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex h-16 items-center justify-between">
              <Link href="/" className="group inline-flex flex-col">
                <span
                  className="
                    text-[22px] md:text-3xl font-extrabold tracking-tight
                    bg-clip-text text-transparent
                    bg-gradient-to-r from-sky-600 via-cyan-400 to-emerald-500
                    drop-shadow transition-transform duration-300
                    group-hover:scale-[1.1]
                  "
                >
                  Smart Freight &amp; Storage Planner
                </span>
                <span
                  className="
                    mt-1 h-[2px] w-full
                    bg-gradient-to-r from-transparent via-sky-400/60 to-transparent
                    transition-transform duration-300 origin-center
                    group-hover:scale-x-105
                  "
                />
              </Link>

              <nav className="flex items-center gap-2 text-sm">
                {user ? (
                  <>
                    <span className="hidden md:inline text-white/70">
                      Hi, <span className="font-semibold text-white">{user.username}</span>
                    </span>
                    <div className="transition-transform duration-200 hover:scale-105">
                      <LogoutButton />
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="
                        rounded-lg px-3 py-1.5
                        border border-white/20 text-white/90
                        hover:text-white hover:bg-white/10
                        transition duration-200 hover:scale-105
                      "
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="
                        rounded-lg px-3.5 py-1.5 font-semibold
                        text-white bg-gradient-to-r from-sky-500 to-cyan-500
                        hover:from-sky-400 hover:to-cyan-400
                        shadow-sm transition duration-200 hover:scale-105
                      "
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </div>
        </header>

        {/* remove animate-fade-in to avoid opacity toggle each route */}
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
          {children}
        </main>

        <footer className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
          <p className="text-xs text-white/60">
            Built for the <span className="text-white/80 font-medium">Shipsy</span> assignment
          </p>
        </footer>
      </body>
    </html>
  );
}
