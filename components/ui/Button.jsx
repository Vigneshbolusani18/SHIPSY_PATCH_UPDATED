export default function Button({ variant = "primary", className = "", ...props }) {
  const base = "btn " + (variant === "ghost" ? "btn-ghost" : "btn-primary");
  return <button className={`${base} ${className}`} {...props} />;
}
