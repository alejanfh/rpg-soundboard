import type { Metadata } from "next";
import Link from "next/link";
import { sounds, type Sound, type SoundCredit, type SoundKind } from "@/sound-library";

export const metadata: Metadata = {
  title: "Créditos | Mesa de sonido",
  description: "Autores, licencias y fuentes de los sonidos de la mesa de sonido",
};

const SECTIONS: { kind: SoundKind; heading: string }[] = [
  { kind: "music", heading: "Música" },
  { kind: "ambience", heading: "Ambiente" },
  { kind: "sfx", heading: "Efectos" },
];

const SOURCE_NAMES: Record<SoundCredit["source"], string> = {
  freesound: "Freesound",
  incompetech: "incompetech.com",
  "internet-archive": "Internet Archive",
  opengameart: "OpenGameArt",
  generated: "Generado",
};

const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/";

/** CC-BY requires indicating that the work was modified. */
const MODIFICATION_NOTICE =
  "Editado para este proyecto (recorte, fundido y normalización de volumen)";

const LINK_CLASS =
  "underline decoration-kelp underline-offset-4 hover:text-bone hover:decoration-verdigris";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {children}
    </a>
  );
}

function CreditLine({ sound }: { sound: Sound }) {
  const { credit } = sound;
  const source = SOURCE_NAMES[credit.source];
  const sourceLink = credit.url ? (
    <ExternalLink href={credit.url}>{source}</ExternalLink>
  ) : (
    source
  );

  if (credit.source === "generated") return <>Generado para este proyecto</>;

  if (credit.license === "CC-BY-4.0") {
    // The attribution wording CC-BY asks for: title, author, source, license.
    return (
      <>
        &quot;{credit.workTitle ?? sound.title}&quot; {credit.author} ({sourceLink}) —
        Licensed under{" "}
        <ExternalLink href={CC_BY_URL}>Creative Commons: By Attribution 4.0</ExternalLink>
        . {MODIFICATION_NOTICE}.
      </>
    );
  }

  return (
    <>
      {credit.author} · {credit.license} · {sourceLink}
    </>
  );
}

export default function Credits() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-10 pb-16 sm:pt-16">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-mist hover:text-bone"
      >
        ← Volver a las partidas
      </Link>

      <header className="mt-4 mb-10">
        <h1 className="font-display text-5xl leading-[0.95] text-brass-bright sm:text-7xl">
          Créditos
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-mist">
          Los sonidos de la mesa proceden de estos autores y fuentes. Gracias a
          todos ellos.
        </p>
      </header>

      {SECTIONS.map(({ kind, heading }) => (
        <section key={kind} aria-labelledby={`${kind}-credits`} className="mt-10">
          <h2
            id={`${kind}-credits`}
            className="border-b border-brass/30 pb-2 font-display text-3xl text-bone"
          >
            {heading}
          </h2>
          <ul className="mt-2 divide-y divide-kelp/60">
            {sounds
              .filter((sound) => sound.kind === kind)
              .map((sound) => (
                <li key={sound.id} className="py-3">
                  <p className="text-lg text-bone">{sound.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-mist">
                    <CreditLine sound={sound} />
                  </p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
