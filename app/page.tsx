"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { verifyAccessHash } from "../lib/access-gate.mjs";

const BirthdayExperience = lazy(() => import("./BirthdayExperience"));

type GateState = "checking" | "denied" | "authorized";

function NeutralEntrance({ checking = false }: { checking?: boolean }) {
  return (
    <main className="access-shell" aria-busy={checking}>
      <section className="access-card" aria-labelledby="access-title">
        <p className="access-eyebrow">Field Notes</p>
        <h1 className="access-title" id="access-title">入口暂不可用</h1>
        <p className="access-copy">请检查你收到的完整地址后重试。</p>
        <p className="access-status" role="status" aria-live="polite">
          {checking ? "正在确认入口…" : "未找到可用入口"}
        </p>
      </section>
    </main>
  );
}

export default function Home() {
  const [gateState, setGateState] = useState<GateState>("checking");

  useEffect(() => {
    let active = true;
    let verificationRun = 0;

    const verifyCurrentHash = async () => {
      const run = ++verificationRun;
      setGateState("checking");

      let authorized = false;
      try {
        authorized = await verifyAccessHash(window.location.hash);
      } catch {
        authorized = false;
      }

      if (active && run === verificationRun) {
        setGateState(authorized ? "authorized" : "denied");
      }
    };

    void verifyCurrentHash();
    window.addEventListener("hashchange", verifyCurrentHash);

    return () => {
      active = false;
      window.removeEventListener("hashchange", verifyCurrentHash);
    };
  }, []);

  if (gateState !== "authorized") {
    return <NeutralEntrance checking={gateState === "checking"} />;
  }

  return (
    <Suspense fallback={<NeutralEntrance checking />}>
      <BirthdayExperience />
    </Suspense>
  );
}
