"use client";

import { useState } from "react";
import { NewPostForm } from "./NewPostForm";
import { NewListingForm } from "./NewListingForm";

type Tab = "muro" | "anuncio";

export function Composer({
  userId,
  defaultTab,
}: {
  userId: string;
  defaultTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className="space-y-4">
      <div className="flex rounded-full bg-brand-100 p-1 text-sm font-medium">
        <button
          onClick={() => setTab("muro")}
          className={`flex-1 rounded-full py-1.5 ${tab === "muro" ? "bg-white text-brand-800 shadow-sm" : "text-stone-500"}`}
        >
          Muro vecinal
        </button>
        <button
          onClick={() => setTab("anuncio")}
          className={`flex-1 rounded-full py-1.5 ${tab === "anuncio" ? "bg-white text-brand-800 shadow-sm" : "text-stone-500"}`}
        >
          Mercadillo
        </button>
      </div>

      {tab === "muro" ? (
        <NewPostForm userId={userId} />
      ) : (
        <NewListingForm userId={userId} />
      )}
    </div>
  );
}
