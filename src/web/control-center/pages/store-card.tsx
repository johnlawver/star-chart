// The store, as grown-ups see it: what's for sale, with pictures and prices. Owners and admins can add an item from
// the built-in list, or upload their own sticker (any picture: drawn, painted or generated).
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../shared/api.js";
import { Art } from "../../observatory/art/components.js";
import { storeItemArt } from "../../observatory/art/manifest.js";

interface Item {
  id: string;
  kind: "sticker" | "hat" | "hair";
  name: string;
  price: number;
  art?: string | null;
}

const pictureTypes = "image/png,image/webp,image/jpeg,image/svg+xml";

function Picture({ item, size = 56 }: { item: Item; size?: number }) {
  return item.art ? (
    <img src={item.art} width={size} height={size} alt={item.name} style={{ objectFit: "contain" }} />
  ) : (
    <span role="img" aria-label={item.name}>
      <Art id={storeItemArt(item)} width={size} />
    </span>
  );
}

export function StoreCard({ canChange }: { canChange: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [available, setAvailable] = useState<Item[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | undefined>();
  const [preview, setPreview] = useState<string | undefined>();

  const load = async () => {
    const result = await api("GET", "/api/store-items");
    if (result.ok) {
      setItems(result.data.items);
      setAvailable(result.data.available);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addBuiltIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const itemId = String(new FormData(event.currentTarget).get("itemId") ?? "");
    if (!itemId) return;
    const result = await api("POST", "/api/store-items", { itemId });
    setMessage(result.ok ? { text: "Added to the store.", ok: true } : { text: result.data?.error ?? "Couldn't add that.", ok: false });
    await load();
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("picture");
    if (!(file instanceof File) || file.size === 0) return;
    if (file.size > 1024 * 1024) return setMessage({ text: "That picture is over 1 MB. Try a smaller one.", ok: false });
    const sent = await fetch("/api/art-files", { method: "POST", headers: { "content-type": file.type }, body: file });
    const picture = await sent.json().catch(() => undefined);
    if (!sent.ok) return setMessage({ text: picture?.error ?? "Couldn't upload that picture.", ok: false });
    const added = await api("POST", "/api/store-items", { name: String(data.get("name")).trim(), price: Number(data.get("price")), artFileId: picture.id });
    if (!added.ok) return setMessage({ text: added.data?.error ?? "Couldn't add that sticker.", ok: false });
    setMessage({ text: "Sticker added to the store.", ok: true });
    setPreview(undefined);
    form.reset();
    await load();
  };

  const choosePicture = (file: File | undefined) => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : undefined);
  };

  return (
    <section aria-label="Store">
      <h2>Store</h2>
      <p className="hint">What the children can buy with their stars at the observatory. No grown-up needs to approve a purchase.</p>
      <ul className="rows store-items">
        {items.map((item) => (
          <li key={item.id}>
            <span className="row-main store-item">
              <Picture item={item} />
              <span>{item.name}</span>
            </span>
            <span className="chip">{item.price} ★</span>
          </li>
        ))}
      </ul>

      {canChange && available.length > 0 && (
        <form onSubmit={addBuiltIn} className="fields">
          <label className="grow">
            Add from the built-in list
            <select name="itemId" defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.price} ★)
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Add</button>
        </form>
      )}

      {canChange && (
        <>
          <h3>Upload a new sticker</h3>
          <p className="hint">A square picture works best: PNG, WebP, JPEG or SVG, up to 1 MB.</p>
          <form onSubmit={upload} className="fields">
            <label className="grow">
              Picture
              <input name="picture" type="file" accept={pictureTypes} required onChange={(event) => choosePicture(event.target.files?.[0])} />
            </label>
            {preview && <img src={preview} width={72} height={72} alt="Preview" className="preview" />}
            <label className="grow">
              Name
              <input name="name" maxLength={40} required placeholder="Dragon" />
            </label>
            <label>
              Price
              <input name="price" type="number" min={1} max={10000} required defaultValue={3} className="narrow" />
            </label>
            <button type="submit" className="primary">
              Add sticker
            </button>
          </form>
        </>
      )}
      {message && <p role={message.ok ? "status" : "alert"}>{message.text}</p>}
    </section>
  );
}
