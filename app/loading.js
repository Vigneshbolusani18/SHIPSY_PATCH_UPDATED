// app/loading.js
export default function Loading() {
  return (
    <div className="min-h-screen bg-[rgb(7,10,14)] text-white flex items-center justify-center">
      <div className="flex flex-col items-center space-y-6">
        {/* Animated logo/brand */}
        <div className="group inline-flex flex-col items-center">
          <span
            className="
              text-2xl md:text-3xl font-extrabold tracking-tight
              bg-clip-text text-transparent
              bg-gradient-to-r from-sky-600 via-cyan-400 to-emerald-500
              drop-shadow animate-pulse
            "
          >
            Smart Freight & Storage Planner
          </span>
          <span
            className="
              mt-2 h-[2px] w-full
              bg-gradient-to-r from-transparent via-sky-400/60 to-transparent
              animate-pulse
            "
          />
        </div>
        
        {/* Loading spinner */}
        <div className="relative">
          <div className="w-12 h-12 border-4 border-white/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-sky-400 rounded-full animate-spin animation-delay-150"></div>
        </div>
        
        {/* Loading text */}
        <p className="text-white/60 text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  );
}