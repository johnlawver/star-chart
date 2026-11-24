// The store, as grown-ups manage it (reached from inside Tasks): what's for sale, with pictures and prices. Owners and
// admins can change any item's price, replace its picture (built-in items can go back to their original), add items
// from the built-in list, and upload their own stickers: drawn, painted or generated.
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../shared/api.js";
import { Art } from "../../observatory/art/components.js";
import { storeItemArt } from "../../observatory/art/manifest.js";
import { manages, type Me } from "../common.js";
import { PageTitle } from "../shell.js";
import { tasksTabs } from "./tasks.js";

interface Item {
  id: string;
  kind: "sticker" | "hat" | "hair";
  name: string;
  price: number;
  art?: string | null;
}

const pictureTypes = "image/png,image/webp,image/jpeg,image/svg+xml";
const largestPicture = 1024 * 1024;

/** An item's own picture if it has one (uploaded, or replaced), otherwise the picture it ships with. */
function Picture({ item, size = 56 }: { item: Item; size?: number }) {
  return item.art ? (
    <img src={item.art} width={size} height={size} alt={item.name} className="picture" />
  ) : (
    <span role="img" aria-label={item.name} className="picture">
      <Art id={storeItemArt(item)} width={size} />
    </span>
  );
}

/** Uploads a picture; resolves with its id, or an error to show. */
async function uploadPicture(file: File): Promise<{ id: string } | { error: string }> {
  if (file.size > largestPicture) return { error: "That picture is over 1 MB. Try a smaller one." };
  const sent = await fetch("/api/art-files", { method: "POST", headers: { "content-type": file.type }, body: file });
  const body = await sent.json().catch(() => undefined);
  return sent.ok ? { id: body.id } : { error: body?.error ?? "Couldn't upload that picture." };
}

type Say = (text: string, ok?: boolean) => void;

function ItemRow({ item, canChange, builtIn, onChanged, say }: { item: Item; canChange: boolean; builtIn: boolean; onChanged: () => Promise<void>; say: Say }) {
  const change = async (body: object, done: string) => {
    const result = await api("PATCH", `/api/store-items/${item.id}`, body);
    say(result.ok ? done : (result.data?.error ?? "Couldn't change that."), result.ok);
    await onChanged();
  };

  const savePrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void change({ price: Number(new FormData(event.currentTarget).get("price")) }, `${item.name} now costs ${new FormData(event.currentTarget).get("price")} ★.`);
  };

  const replacePicture = async (file: File | undefined) => {
    if (!file) return;
    const uploaded = await uploadPicture(file);
    if ("error" in uploaded) return say(uploaded.error, false);
    await change({ artFileId: uploaded.id }, `${item.name} has a new picture.`);
  };

  return (
    <li>
      <span className="row-main store-item">
        <Picture item={item} />
        <span>
          {item.name}
          {builtIn && item.art && <small> (your picture)</small>}
        </span>
      </span>
      {canChange ? (
        <span className="row-actions">
          <form onSubmit={savePrice} className="price-form">
            <label className="inline">
              <input name="price" type="number" min={1} max={10000} required defaultValue={item.price} key={item.price} className="narrow" aria-label="Price" /> ★
            </label>
            <button type="submit">Save price</button>
          </form>
          <label className="file-button">
            Replace picture
            <input type="file" accept={pictureTypes} onChange={(event) => void replacePicture(event.target.files?.[0])} />
          </label>
          {builtIn && item.art && (
            <button className="quiet" onClick={() => change({ artFileId: null }, `${item.name} has its original picture back.`)}>
              Use the original picture
            </button>
          )}
        </span>
      ) : (
        <span className="chip">{item.price} ★</span>
      )}
    </li>
  );
}

export function StorePage({ me }: { me: Me }) {
  const canChange = manages(me);
  const [items, setItems] = useState<Item[]>([]);
  const [available, setAvailable] = useState<Item[]>([]);
  const [builtInIds, setBuiltInIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; ok: boolean } | undefined>();
  const [preview, setPreview] = useState<string | undefined>();
  const say: Say = (text, ok = true) => setMessage({ text, ok });

  const load = async () => {
    const result = await api("GET", "/api/store-items");
    if (!result.ok) return;
    setItems(result.data.items);
    setAvailable(result.data.available);
    // Built-in items keep their plain ids; a chart's own stickers are "sticker-…".
    setBuiltInIds(new Set(result.data.items.filter((item: Item) => !item.id.startsWith("sticker-")).map((item: Item) => item.id)));
  };

  useEffect(() => {
    void load();
  }, []);

  const addBuiltIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const itemId = String(new FormData(event.currentTarget).get("itemId") ?? "");
    if (!itemId) return;
    const result = await api("POST", "/api/store-items", { itemId });
    say(result.ok ? "Added to the store." : (result.data?.error ?? "Couldn't add that."), result.ok);
    await load();
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("picture");
    if (!(file instanceof File) || file.size === 0) return;
    const picture = await uploadPicture(file);
    if ("error" in picture) return say(picture.error, false);
    const added = await api("POST", "/api/store-items", { name: String(data.get("name")).trim(), price: Number(data.get("price")), artFileId: picture.id });
    if (!added.ok) return say(added.data?.error ?? "Couldn't add that sticker.", false);
    say("Sticker added to the store.");
    setPreview(undefined);
    form.reset();
    await load();
  };

  const choosePicture = (file: File | undefined) => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : undefined);
  };

  return (
    <>
      <PageTitle title="Store" tabs={tasksTabs} current="store" />
      {message && (
        <p role={message.ok ? "status" : "alert"} className="toast">
          {message.text}
        </p>
      )}
      <section aria-label="In the store">
        <h2>In the store</h2>
        <p className="hint">What the children can buy with their stars at the observatory. Purchases don't need a grown-up.</p>
        <ul className="rows store-items">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} canChange={canChange} builtIn={builtInIds.has(item.id)} onChanged={load} say={say} />
          ))}
        </ul>
      </section>

      {canChange && (
        <section aria-label="Upload a new sticker">
          <h2>Upload a new sticker</h2>
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
        </section>
      )}

      {canChange && available.length > 0 && (
        <section aria-label="Add from the built-in list">
          <h2>Add from the built-in list</h2>
          <form onSubmit={addBuiltIn} className="fields">
            <label className="grow">
              Item
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
        </section>
      )}
    </>
  );
}
