import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mt-8 p-10 text-center">
      <p className="font-display text-3xl font-semibold text-brand-800">
        Ups…
      </p>
      <p className="mt-2 text-stone-500">
        No encontramos esta página.
      </p>
      <Link href="/" className="btn-primary mt-4">
        Volver a los bandos
      </Link>
    </div>
  );
}
