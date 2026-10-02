import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getSound, sounds } from "@/sound-library";
import Credits from "./page";

describe("Credits page", () => {
  it("has a heading, grouped sections and a link back home", () => {
    render(<Credits />);

    expect(screen.getByRole("heading", { level: 1, name: "Créditos" })).toBeInTheDocument();
    for (const name of ["Música", "Ambiente", "Efectos"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /Volver/ })).toHaveAttribute("href", "/");
  });

  it("lists every sound exactly once", () => {
    render(<Credits />);

    expect(screen.getAllByRole("listitem")).toHaveLength(sounds.length);
  });

  it("credits CC-BY tracks in the required attribution form", () => {
    render(<Credits />);

    const sound = getSound("radio-epoca")!;
    const item = screen.getByText(sound.title).closest("li")!;
    expect(item).toHaveTextContent(
      '"Maple Leaf Rag" Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0',
    );
    expect(
      within(item).getByRole("link", { name: "Creative Commons: By Attribution 4.0" }),
    ).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
    expect(within(item).getByRole("link", { name: "incompetech.com" })).toHaveAttribute(
      "href",
      sound.credit.url,
    );
  });

  it("credits CC0 sounds with author, license and source link", () => {
    render(<Credits />);

    const sound = getSound("cristal-estalla")!;
    const item = screen.getByText(sound.title).closest("li")!;
    expect(item).toHaveTextContent("unfa");
    expect(item).toHaveTextContent("CC0");
    expect(within(item).getByRole("link", { name: "Freesound" })).toHaveAttribute(
      "href",
      sound.credit.url,
    );
  });

  it("marks generated sounds as made for this project", () => {
    render(<Credits />);

    const generated = sounds.filter((sound) => sound.credit.source === "generated");
    expect(generated.length).toBeGreaterThan(0);
    for (const sound of generated) {
      const item = screen.getByText(sound.title).closest("li")!;
      expect(item).toHaveTextContent("Generado para este proyecto");
      expect(within(item).queryByRole("link")).not.toBeInTheDocument();
    }
  });
});
