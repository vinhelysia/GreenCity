import { APP_NAME } from "@greencity/shared";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-emerald-800">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-lg text-stone-600">
        Phase 0 shell. This is a placeholder home page — no marketplace features
        yet.
      </p>
    </main>
  );
}
