export default function Card({ title, action, children }) {
  return (
    <section className="card p-6 bg-white/10 backdrop-blur-md border border-white/20 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {action}
      </div>
      {children}
    </section>
  );
}