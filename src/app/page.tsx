"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-black">
      <button
        onClick={() => router.push("/login")}
        className="px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
      >
        Proceed to Login
      </button>
    </main>
  );
}