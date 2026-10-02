import Link from "next/link";
import { adventures, type Adventure } from "@/adventures";

const SYSTEM_NAMES: Record<Adventure["system"], string> = {
  "el-rastro-de-cthulhu": "El rastro de Cthulhu",
};

export default function Home() {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-14 pb-10 sm:pt-24">
        <header className="mb-12 sm:mb-16">
          <h1 className="font-display text-6xl leading-[0.95] text-brass-bright sm:text-8xl">
            Mesa de sonido
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-mist">
            Música, ambiente y efectos preparados escena a escena, para dirigir la
            partida sin apartar la vista de la mesa.
          </p>
        </header>

        <ul className="grid gap-6">
          {adventures.map((adventure) => (
            <li key={adventure.id}>
              <Link
                href={`/partidas/${adventure.id}`}
                className="block rounded-lg border border-kelp border-t-4 border-t-brass bg-tank/70 px-6 py-6 hover:border-verdigris hover:border-t-brass-bright sm:px-8"
              >
                <p className="text-sm text-verdigris">
                  {SYSTEM_NAMES[adventure.system]}
                </p>
                <h2 className="mt-1 font-display text-3xl leading-tight text-bone sm:text-4xl">
                  {adventure.title}
                </h2>
                <p className="mt-4 max-w-prose leading-relaxed text-mist">
                  {adventure.synopsis}
                </p>
                <span className="mt-6 inline-flex min-h-11 items-center font-medium text-brass">
                  Abrir la mesa de sonido
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-5 pb-10 text-sm">
        <Link
          href="/creditos"
          className="inline-flex min-h-11 items-center text-mist underline decoration-kelp underline-offset-4 hover:text-bone"
        >
          Créditos de los sonidos
        </Link>
      </footer>
    </>
  );
}
