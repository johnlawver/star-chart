import { useEffect, useState } from "react";

export interface IconChoice {
  id: string;
  label: string;
}

/** An icon from the built-in library, drawn in pure black. */
export function Icon({ id, size = 48, label }: { id: string | null | undefined; size?: number; label?: string }) {
  if (!id) return null;
  return <img src={`/api/icons/${id}.svg`} width={size} height={size} alt={label ?? ""} />;
}

/** A plain picker for choosing an icon from the library, with a preview of the current choice. */
export function IconPicker({ name = "icon" }: { name?: string }) {
  const [icons, setIcons] = useState<IconChoice[]>([]);
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    void fetch("/api/icons")
      .then((response) => response.json())
      .then((data) => setIcons(data.icons));
  }, []);

  return (
    <label>
      Icon{" "}
      <select name={name} value={chosen} onChange={(event) => setChosen(event.target.value)}>
        <option value="">(none)</option>
        {icons.map((icon) => (
          <option key={icon.id} value={icon.id}>
            {icon.label}
          </option>
        ))}
      </select>{" "}
      <Icon id={chosen} size={24} />
    </label>
  );
}
