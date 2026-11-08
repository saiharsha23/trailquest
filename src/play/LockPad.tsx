import { useEffect, useState } from "react";

interface LockPadProps {
  digitsCount?: 3 | 4;
  onSubmit: (code: string) => Promise<void> | void;
  busy?: boolean;
  err?: string;
  isFinal?: boolean;
  onSwitchToText?: () => void;
}

export default function LockPad({
  digitsCount = 4,
  onSubmit,
  busy = false,
  err = "",
  isFinal = false,
  onSwitchToText,
}: LockPadProps) {
  const [numDigits, setNumDigits] = useState<3 | 4>(digitsCount);
  const [digits, setDigits] = useState<string[]>(() => Array(digitsCount).fill(""));
  const [shake, setShake] = useState(false);

  // Trigger shake animation when an error occurs
  useEffect(() => {
    if (err) {
      setShake(true);
      const timer = setTimeout(() => {
        setShake(false);
        // Clear digits on error so user can re-enter cleanly
        setDigits(Array(numDigits).fill(""));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [err, numDigits]);

  const changeNumDigits = (n: 3 | 4) => {
    setNumDigits(n);
    setDigits(Array(n).fill(""));
  };

  const addDigit = (d: string) => {
    if (busy) return;
    setDigits((prev) => {
      const idx = prev.findIndex((v) => v === "");
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = d;
      return next;
    });
  };

  const backspace = () => {
    if (busy) return;
    setDigits((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i] !== "") {
          next[i] = "";
          break;
        }
      }
      return next;
    });
  };

  const clearAll = () => {
    if (busy) return;
    setDigits(Array(numDigits).fill(""));
  };

  const handleUnlock = () => {
    const code = digits.join("");
    if (code.length === numDigits && !busy) {
      onSubmit(code);
    }
  };

  // Keyboard support for desktop / physical keyboards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key >= "0" && e.key <= "9") {
        addDigit(e.key);
      } else if (e.key === "Backspace") {
        backspace();
      } else if (e.key === "Enter") {
        const code = digits.join("");
        if (code.length === numDigits) {
          handleUnlock();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [digits, numDigits, busy]);

  const isComplete = digits.every((d) => d !== "");

  return (
    <div className={`grid gap-4 bg-cream/40 border-2 border-line rounded-3xl p-5 ${shake ? "animate-shake" : ""}`}>
      <div className="text-center">
        {/* Antique Padlock Visual */}
        <div className="inline-flex flex-col items-center justify-center mb-2">
          <div className="w-9 h-7 border-4 border-antique border-b-0 rounded-t-full -mb-1" aria-hidden />
          <div className="w-14 h-11 bg-gradient-to-b from-antique to-[#8C4610] rounded-xl flex items-center justify-center shadow-md border border-[#7A3D0E]">
            <div className="w-2.5 h-4 bg-ink/70 rounded-full flex flex-col items-center justify-center">
              <div className="w-1 h-1 bg-ivory rounded-full mb-0.5" />
            </div>
          </div>
        </div>

        <p className="text-xs tracking-[.25em] text-antique font-bold uppercase">
          {isFinal ? "Final Destination Vault" : "Combination Lock"}
        </p>
        <p className="text-xs text-muted mt-1">Enter the 3-digit or 4-digit code to unlock</p>
      </div>

      {/* Mode Selector (3 Digits vs 4 Digits) */}
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => changeNumDigits(3)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            numDigits === 3
              ? "bg-antique text-white shadow-sm"
              : "bg-card border border-line text-muted hover:text-ink"
          }`}
        >
          3 Digits
        </button>
        <button
          type="button"
          onClick={() => changeNumDigits(4)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            numDigits === 4
              ? "bg-antique text-white shadow-sm"
              : "bg-card border border-line text-muted hover:text-ink"
          }`}
        >
          4 Digits
        </button>
      </div>

      {/* Digit Slots Display */}
      <div className="flex justify-center gap-3 my-1">
        {digits.map((digit, i) => {
          const isNext = digits.findIndex((d) => d === "") === i;
          return (
            <div
              key={i}
              className={`w-12 h-14 bg-card border-2 flex items-center justify-center font-mono text-3xl font-bold rounded-2xl transition-all ${
                err
                  ? "border-bad text-bad bg-bad/5"
                  : digit
                  ? "border-antique text-ink shadow-sm bg-gold/20"
                  : isNext
                  ? "border-antique ring-2 ring-antique/30"
                  : "border-line text-muted/40"
              }`}
            >
              {digit || (isNext ? "·" : "—")}
            </div>
          );
        })}
      </div>

      {/* Numeric Touch Keypad */}
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto w-full">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onClick={() => addDigit(n)}
            className="h-12 rounded-2xl bg-card border border-line font-serif text-2xl font-bold text-ink hover:bg-gold/30 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
          >
            {n}
          </button>
        ))}

        {/* Backspace */}
        <button
          type="button"
          disabled={busy || digits.every((d) => d === "")}
          onClick={backspace}
          aria-label="Delete last digit"
          className="h-12 rounded-2xl bg-card border border-line font-serif text-lg font-bold text-muted hover:text-bad hover:bg-bad/10 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center"
        >
          ⌫
        </button>

        {/* 0 */}
        <button
          type="button"
          disabled={busy}
          onClick={() => addDigit("0")}
          className="h-12 rounded-2xl bg-card border border-line font-serif text-2xl font-bold text-ink hover:bg-gold/30 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
        >
          0
        </button>

        {/* Unlock Submit */}
        <button
          type="button"
          disabled={busy || !isComplete}
          onClick={handleUnlock}
          className="h-12 rounded-2xl bg-antique text-white font-sans text-xs font-bold tracking-wider uppercase hover:bg-antique/90 active:scale-95 disabled:opacity-40 transition-all shadow-sm flex items-center justify-center gap-1"
        >
          {busy ? (
            "Checking…"
          ) : (
            <>
              <span>🔓</span>
              <span>Open</span>
            </>
          )}
        </button>
      </div>

      {/* Switch to standard text input toggle */}
      {onSwitchToText && (
        <button
          type="button"
          onClick={onSwitchToText}
          className="text-xs text-muted hover:text-ink underline text-center block mt-1"
        >
          Switch to text answer input
        </button>
      )}
    </div>
  );
}

