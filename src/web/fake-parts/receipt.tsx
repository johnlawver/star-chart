import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";

/** A print job, exactly as the server sends it to any printer. */
export interface PrintJob {
  id: string;
  childNickname: string;
  displayStyle: "pictures" | "words";
  title: string;
  icon: string | null;
  stars: number;
  code: string;
  quiz?: { instructions: string; prompts: string[] };
}

// A thermal printer is 58 mm wide (384 dots) and prints pure black on white, with no greys.
export function Receipt({ job }: { job: PrintJob }) {
  const [qr, setQr] = useState<string | undefined>();
  useEffect(() => {
    void QRCode.toDataURL(job.code, { margin: 1, width: 256, color: { dark: "#000000", light: "#ffffff" } }).then(setQr);
  }, [job.code]);

  return (
    <article
      data-testid="receipt"
      style={{
        width: 384,
        background: "#fff",
        color: "#000",
        fontFamily: "monospace",
        padding: 16,
        margin: "16px 0",
        border: "1px dashed #000",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{job.childNickname}</div>
      {job.displayStyle === "pictures" && job.icon ? (
        <img src={`/api/icons/${job.icon}.svg`} alt={job.title} width={192} height={192} style={{ margin: "12px 0" }} />
      ) : (
        <div style={{ fontSize: 24, margin: "12px 0" }}>{job.title}</div>
      )}
      <div style={{ fontSize: 20 }}>{"★".repeat(job.stars) || "no stars"}</div>
      {job.quiz && (
        <div style={{ textAlign: "left", fontSize: 18, margin: "12px 0" }}>
          <p>{job.quiz.instructions}</p>
          <ol>
            {job.quiz.prompts.map((prompt, index) => (
              <li key={index} style={{ marginBottom: 12 }}>
                {prompt} ____________
              </li>
            ))}
          </ol>
        </div>
      )}
      {qr && <img src={qr} alt={`QR code ${job.code}`} width={256} height={256} style={{ imageRendering: "pixelated" }} />}
      <div style={{ fontSize: 14 }}>{job.code}</div>
    </article>
  );
}

/** A slip the way a 58 mm thermal printer prints it: pure black on white, 384 dots wide. */
export function Slip({ children }: { children: ReactNode }) {
  return (
    <article
      data-testid="slip"
      style={{ width: 384, background: "#fff", color: "#000", fontFamily: "monospace", padding: 16, margin: "16px 0", border: "1px dashed #000", textAlign: "center" }}
    >
      {children}
    </article>
  );
}
