import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adventures, getAdventure } from "@/adventures";
import { Soundboard } from "@/soundboard/soundboard";

// Static export: only the known adventures exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return adventures.map((adventure) => ({ id: adventure.id }));
}

export async function generateMetadata(
  props: PageProps<"/partidas/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const adventure = getAdventure(id);
  return { title: adventure ? `${adventure.title} | Mesa de sonido` : "Mesa de sonido" };
}

export default async function SoundboardPage(props: PageProps<"/partidas/[id]">) {
  const { id } = await props.params;
  const adventure = getAdventure(id);
  if (!adventure) notFound();
  return <Soundboard adventure={adventure} />;
}
